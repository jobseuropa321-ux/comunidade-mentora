import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast-glass-liquid group-[.toaster]:text-[#1E1B11] group-[.toaster]:rounded-2xl group-[.toaster]:border-0 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[#5B4041]",
          actionButton: "group-[.toast]:bg-[#BE0D3E] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[#BE0D3E]/10 group-[.toast]:text-[#5B4041]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
