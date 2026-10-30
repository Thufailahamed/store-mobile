import React, { useRef } from "react";
import {
  Modal as RNModal,
  NativeModules,
  Platform,
  View,
  findNodeHandle,
  useWindowDimensions,
  type ModalProps,
} from "react-native";

const ModalSizeFix: { sync(tag: number): void } | undefined =
  NativeModules.LuxeModalSizeFix;

/**
 * Drop-in replacement for react-native's Modal.
 *
 * On Android (RN 0.76 Fabric, seen on Android 16) the Modal's content root lays out at
 * 0x0 and ignores the dialog's size updates. Two consequences, two workarounds:
 * - Layout: `flex: 1` / percentage sizes collapse, so children render inside a view
 *   pinned to the window size instead of relying on the root.
 * - Touch: Android won't route touches into the 0x0 native container, so each DOWN
 *   reaches JS twice and no press ever fires. Once shown, the native LuxeModalSizeFix
 *   module resizes that container's native frame, located via a probe view.
 */
export function Modal({ children, onShow, ...props }: ModalProps) {
  const probe = useRef<View>(null);
  const { width, height } = useWindowDimensions();

  if (Platform.OS !== "android") {
    return (
      <RNModal {...props} onShow={onShow}>
        {children}
      </RNModal>
    );
  }

  return (
    <RNModal
      {...props}
      onShow={(e) => {
        const tag = findNodeHandle(probe.current);
        if (tag != null) ModalSizeFix?.sync(tag);
        onShow?.(e);
      }}
    >
      <View
        ref={probe}
        collapsable={false}
        pointerEvents="none"
        style={{ position: "absolute", width: 0, height: 0 }}
      />
      <View style={{ position: "absolute", top: 0, left: 0, width, height }}>{children}</View>
    </RNModal>
  );
}
