import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn, triggerHaptic } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";

export interface OrderTrackingProps
  extends React.HTMLAttributes<HTMLDivElement> {
  steps: {
    name: string;
    timestamp: string;
    isCompleted: boolean;
  }[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const iconVariants: Variants = {
  hidden: { scale: 0, rotate: -180 },
  visible: { scale: 1, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 25 } },
};

const lineVariants: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { duration: 0.2, ease: "easeInOut" } },
};

const OrderTracking = React.forwardRef<HTMLDivElement, OrderTrackingProps>(
  ({ steps = [], className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        {steps.length > 0 ? (
          <motion.div
            className="flex flex-col"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {steps.map((step, index) => (
              <motion.div 
                key={index} 
                className="flex min-h-[64px]" 
                variants={itemVariants}
                onAnimationStart={() => triggerHaptic('light')}
              >
                <div className="flex flex-col items-center">
                  <motion.div variants={iconVariants} className="relative z-10 bg-white rounded-full">
                    {step.isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 shrink-0 text-[#3FC2AC]" />
                    ) : (
                      <Circle className="h-6 w-6 shrink-0 text-[#A0A09D]" />
                    )}
                  </motion.div>
                  {index < steps.length - 1 && (
                    <div className="w-[2px] grow my-1 relative bg-[#E8E8E5] overflow-hidden origin-top">
                      {steps[index + 1].isCompleted && (
                        <motion.div
                          className="absolute top-0 left-0 w-full h-full bg-[#3FC2AC] origin-top"
                          variants={lineVariants}
                        />
                      )}
                    </div>
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
              </motion.div>
            ))}
          </motion.div>
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
