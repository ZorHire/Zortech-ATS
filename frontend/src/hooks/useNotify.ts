import { useAppDispatch } from "./useAppDispatch";
import { addNotification } from "../store/slices/notificationSlice";

export function useNotify() {
  const dispatch = useAppDispatch();
  return {
    success: (message: string) => dispatch(addNotification({ message, type: "success" })),
    error:   (message: string) => dispatch(addNotification({ message, type: "error" })),
    info:    (message: string) => dispatch(addNotification({ message, type: "info" })),
    warning: (message: string) => dispatch(addNotification({ message, type: "warning" })),
  };
}
