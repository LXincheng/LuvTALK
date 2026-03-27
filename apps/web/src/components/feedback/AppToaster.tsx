import { Toaster } from 'sonner';

type ToastStatus = 'info' | 'success' | 'warning' | 'error' | 'loading';

function ToastStatusIcon({ status }: { status: ToastStatus }) {
  return (
    <span
      aria-hidden="true"
      className={`app-toast-status app-toast-status--${status}`}
    >
      <span className="app-toast-status__core" />
    </span>
  );
}

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      visibleToasts={3}
      expand={false}
      gap={12}
      offset={20}
      mobileOffset={16}
      closeButton={false}
      richColors={false}
      icons={{
        info: <ToastStatusIcon status="info" />,
        success: <ToastStatusIcon status="success" />,
        warning: <ToastStatusIcon status="warning" />,
        error: <ToastStatusIcon status="error" />,
        loading: <ToastStatusIcon status="loading" />,
      }}
      toastOptions={{
        duration: 4200,
        unstyled: true,
        classNames: {
          toast: 'app-toast',
          content: 'app-toast__content',
          title: 'app-toast__title',
          description: 'app-toast__description',
          icon: 'app-toast__icon',
          actionButton: 'app-toast__action',
          cancelButton: 'app-toast__cancel',
          closeButton: 'app-toast__close',
        },
      }}
    />
  );
}
