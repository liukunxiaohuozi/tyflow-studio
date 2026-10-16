import { ConfigProvider, Drawer } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Display-only task content. Destructive confirmations keep their existing Modal. */
export default function ContentDrawer({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      // The caller unmounts this component on close, before Drawer can finish its motion.
      const element = trigger.current;
      if (element?.isConnected) element.focus({ preventScroll: true });
    };
  }, []);
  return (
    <ConfigProvider
      locale={document.documentElement.lang === "en-US" ? enUS : zhCN}
    >
      <Drawer
        open
        title={title}
        aria-label={title}
        placement="right"
        size="min(840px, 100vw)"
        rootClassName="studio-content-drawer"
        closable={{ placement: "end", closeIcon: <X size={18} /> }}
        mask={{ closable: true }}
        keyboard
        focusable={{ trap: true, focusTriggerAfterClose: true }}
        onClose={close}
        styles={{
          header: { padding: 16, borderColor: "var(--line)" },
          body: { padding: 16, overflow: "auto", minWidth: 0 },
          footer: { padding: 16 },
          section: { background: "var(--surface)", color: "var(--ink)" },
          title: { color: "var(--ink)" },
          close: {
            minHeight: 28,
            width: 28,
            height: 28,
            padding: 0,
            color: "var(--muted)",
          },
        }}
      >
        {children}
      </Drawer>
    </ConfigProvider>
  );
}
