import { AnimationBuilder, createAnimation } from '@ionic/core';

export const fadePageTransition: AnimationBuilder = (baseEl, opts) => {
  const duration = 280;
  const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';
  const enteringEl = opts.enteringEl;
  const leavingEl = opts.leavingEl;

  const enteringAnimation = createAnimation()
    .addElement(enteringEl)
    .duration(duration)
    .easing(easing)
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('opacity', '0', '1')
    .fromTo('transform', 'translateY(8px)', 'translateY(0)');

  if (!leavingEl) {
    return enteringAnimation;
  }

  const leavingAnimation = createAnimation()
    .addElement(leavingEl)
    .duration(duration - 80)
    .easing('linear')
    .fromTo('opacity', '1', '0')
    .fromTo('transform', 'translateY(0)', 'translateY(-4px)');

  return createAnimation().addAnimation([enteringAnimation, leavingAnimation]);
};
