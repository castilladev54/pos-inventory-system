import { motion } from "framer-motion";

const FloatingShape = ({ color, size, top, left, delay }) => {
  return (
    <motion.div
      className={`absolute rounded-full ${color} ${size} opacity-20 blur-3xl`}
      style={{ top, left }}
      animate={{
        y: ["0", "-40", "0"],
        x: ["0", "30", "0%"],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 20,
        ease: "easeInOut",
        repeat: Infinity,
        delay,
      }}
      aria-hidden="true"
    />
  );
};
export default FloatingShape;
