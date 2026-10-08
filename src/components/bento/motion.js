export const tileSpring = { type: 'spring', stiffness: 320, damping: 28, mass: 0.9 };

export const tileVariants = {
  rest: { y: 0, scale: 1, transition: tileSpring },
  hover: { y: -3, scale: 1.015, transition: tileSpring },
  press: { y: 0, scale: 0.985, transition: tileSpring },
};
