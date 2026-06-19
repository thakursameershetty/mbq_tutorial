import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OrderTrackingProps
  extends React.HTMLAttributes<HTMLDivElement> {
  steps: {
    name: string;
    timestamp: string;
    isCompleted: boolean;
  }[];
}

const OrderTracking = React.forwardRef<HTMLDivElement, OrderTrackingProps>(
  ({ steps = [], className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        {steps.length > 0 ? (
          <div className="flex flex-col">
            {steps.map((step, index) => (
              <div key={index} className="flex min-h-[64px]">
                <div className="flex flex-col items-center">
                  {step.isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-[#3FC2AC]" />
                  ) : (
                    <Circle className="h-6 w-6 shrink-0 text-[#A0A09D]" />
                  )}
                  {index < steps.length - 1 && (
                    <div
                      className={cn("w-[2px] grow my-1", {
                        "bg-[#3FC2AC]": steps[index + 1].isCompleted,
                        "bg-[#E8E8E5]": !steps[index + 1].isCompleted,
                      })}
                    />
                  )}
                </div>
                <div className="ml-4 pb-4 flex flex-col justify-start">
                  <p className={cn("text-sm font-bold leading-tight", step.isCompleted ? "text-[#1A1A19]" : "text-[#8B8B86]")}>
                    {step.name}
                  </p>
                  <p className="text-xs text-[#8B8B86] mt-0.5 font-medium">
                    {step.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#8B8B86]">
            This profile has no tracking information.
          </p>
        )}
      </div>
    );
  }
);
OrderTracking.displayName = "OrderTracking";

export { OrderTracking };
