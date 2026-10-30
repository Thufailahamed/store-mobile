package com.luxe.marketplace

import android.view.View
import android.view.ViewGroup
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.views.modal.ReactModalHostView

/**
 * Works around RN 0.76 Fabric Modals on newer Android (seen on 16): the Modal's content
 * container lays out at 0x0 and the dialog's size updates never take effect. Content
 * still draws (overflow), but Android only dispatches touches to children whose bounds
 * contain the point, so the dialog root handles every DOWN itself, JS receives it twice,
 * and no press ever completes.
 *
 * JS calls [sync] from Modal.onShow with the tag of a view inside the Modal. We walk up to
 * the DialogRootViewGroup, re-send its size to Fabric (harmless if it already applies),
 * and stretch any collapsed direct child's native frame to the dialog size so touches are
 * routed into the React tree again. Fabric only rewrites a frame when its own layout for
 * that view changes, and a layout listener re-applies the stretch if it collapses again.
 */
class ModalSizeFixModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "LuxeModalSizeFix"

  @ReactMethod
  fun sync(reactTag: Int) {
    UiThreadUtil.runOnUiThread { trySync(reactTag, attemptsLeft = 10) }
  }

  private fun trySync(reactTag: Int, attemptsLeft: Int) {
    val root = findDialogRoot(reactTag)
    if (root != null && root.width > 0 && root.height > 0) {
      root.updateState(root.width, root.height)
      for (i in 0 until root.childCount) stretchToParent(root.getChildAt(i), root)
      return
    }
    // The probe view or the dialog layout may not be mounted yet; retry next frame.
    if (attemptsLeft > 0) {
      UiThreadUtil.runOnUiThread({ trySync(reactTag, attemptsLeft - 1) }, 16)
    }
  }

  private fun stretchToParent(child: View, parent: ViewGroup) {
    val stretch = {
      if (child.width < parent.width || child.height < parent.height) {
        child.layout(0, 0, parent.width, parent.height)
      }
    }
    stretch()
    if (child.getTag(R.id.luxe_modal_size_fix) == null) {
      child.setTag(R.id.luxe_modal_size_fix, true)
      child.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> child.post(stretch) }
    }
  }

  private fun findDialogRoot(reactTag: Int): ReactModalHostView.DialogRootViewGroup? {
    val view =
        try {
          UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, reactTag)
              ?.resolveView(reactTag)
        } catch (_: Exception) {
          null
        } ?: return null
    var current: View? = view
    while (current != null) {
      if (current is ReactModalHostView.DialogRootViewGroup) return current
      current = current.parent as? View
    }
    return null
  }
}

class ModalSizeFixPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
      listOf(ModalSizeFixModule(context))

  override fun createViewManagers(
      context: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
