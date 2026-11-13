//
// NotificationService — downloads the rich-push image and attaches it.
//
// iOS only shows an image in a remote notification if a Notification
// Service Extension adds it as an attachment. The backend
// (store-backend/src/lib/rich-push.ts) sends `mutableContent: true`, the
// image as `richContent.image`, and a copy in the data payload as
// `image_url` (Expo delivers data under the APNs `body` key). Any of those
// is accepted. On any failure the notification is shown without the image.
//

import UserNotifications
import os

private let log = Logger(subsystem: "com.vestara.marketplace.NotificationService", category: "rich-push")

final class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    bestAttempt = request.content.mutableCopy() as? UNMutableNotificationContent

    let keys = request.content.userInfo.keys.map { "\($0)" }.sorted().joined(separator: ",")
    guard let content = bestAttempt, let url = Self.imageURL(from: request.content.userInfo) else {
      log.info("no image url; payload keys=\(keys, privacy: .public)")
      contentHandler(request.content)
      return
    }
    log.info("downloading image host=\(url.host ?? "-", privacy: .public) keys=\(keys, privacy: .public)")

    URLSession.shared.downloadTask(with: url) { tmp, response, _ in
      defer { contentHandler(content) }
      guard let tmp = tmp else { return }
      // Only attach a real image: an error page saved as .jpg would render
      // as a broken attachment. iOS caps image attachments at 10 MB.
      guard let http = response as? HTTPURLResponse, http.statusCode == 200,
            (http.mimeType ?? "").lowercased().hasPrefix("image/"),
            let size = (try? FileManager.default.attributesOfItem(atPath: tmp.path)[.size]) as? NSNumber,
            size.intValue > 0, size.intValue <= 10 * 1024 * 1024
      else {
        log.error("image rejected: status=\((response as? HTTPURLResponse)?.statusCode ?? -1, privacy: .public) mime=\(response?.mimeType ?? "-", privacy: .public)")
        return
      }
      let ext = Self.fileExtension(url: url, mime: response?.mimeType)
      // Own folder per attachment: iOS stages the file by copying it out of
      // our temp dir, and on the simulator that dir is shared with the
      // stager — a bare file at the temp root collided ("already exists")
      // and the attachment ended up missing.
      let folder = FileManager.default.temporaryDirectory
        .appendingPathComponent("rich-push", isDirectory: true)
        .appendingPathComponent(UUID().uuidString, isDirectory: true)
      let dest = folder.appendingPathComponent("image").appendingPathExtension(ext)
      do {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try FileManager.default.moveItem(at: tmp, to: dest)
        let attachment = try UNNotificationAttachment(identifier: "image", url: dest, options: nil)
        content.attachments = [attachment]
        log.info("image attached")
      } catch {
        // Show the notification without the image.
        log.error("attach failed: \(error.localizedDescription, privacy: .public)")
      }
    }.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let handler = contentHandler, let content = bestAttempt {
      handler(content)
    }
  }

  // MARK: - Helpers

  private static func imageURL(from userInfo: [AnyHashable: Any]) -> URL? {
    var candidates: [Any?] = []
    if let rich = userInfo["richContent"] as? [String: Any] { candidates.append(rich["image"]) }
    candidates.append(userInfo["image_url"])
    if let body = userInfo["body"] as? [String: Any] {
      candidates.append(body["image_url"])
    } else if let bodyString = userInfo["body"] as? String,
              let data = bodyString.data(using: .utf8),
              let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
      candidates.append(body["image_url"])
    }
    for case let string as String in candidates {
      if let url = URL(string: string), url.scheme?.lowercased() == "https" { return url }
    }
    return nil
  }

  private static func fileExtension(url: URL, mime: String?) -> String {
    switch mime?.lowercased() {
    case "image/png": return "png"
    case "image/gif": return "gif"
    case "image/webp": return "webp"
    case "image/jpeg", "image/jpg": return "jpg"
    default:
      let ext = url.pathExtension.lowercased()
      return ["png", "gif", "jpg", "jpeg", "webp"].contains(ext) ? ext : "jpg"
    }
  }
}
