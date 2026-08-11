export function shouldHideReviewPresentationEntity(fixture: string, entityId: string): boolean {
  if (fixture === 'enemy-vehicle-socket-review') return entityId.startsWith('b-enemy-socket-');
  if (fixture === 'combat-vehicle-family-review') return entityId.startsWith('b-combat-vehicle-family-');
  return false;
}

export function shouldHideReviewPresentationBlocker(fixture: string, blockerId: string): boolean {
  return fixture === 'combat-vehicle-family-review'
    && blockerId === 'blocker-combat-vehicle-family-vision-divider';
}

export function replayFixtureLoadError(activeFixture: string, savedFixture: string): string | null {
  if (activeFixture === savedFixture) return null;
  return `存档场景“${savedFixture}”与当前场景“${activeFixture}”不一致，请切换到对应场景后再载入。`;
}
