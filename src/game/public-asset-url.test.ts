import { describe, expect, it } from 'vitest';

import { resolvePublicAssetUrl } from './public-asset-url';

describe('public asset URLs', () => {
  it('keeps root-hosted development assets at the site root', () => {
    expect(resolvePublicAssetUrl('/', '/assets/models/unit.glb'))
      .toBe('/assets/models/unit.glb');
  });

  it('places assets below a GitHub Pages project base', () => {
    expect(resolvePublicAssetUrl('/0810-faultline-front/', '/assets/basis/'))
      .toBe('/0810-faultline-front/assets/basis/');
  });

  it('normalizes missing and repeated separators', () => {
    expect(resolvePublicAssetUrl('/0810-faultline-front', '///assets/models/unit.glb'))
      .toBe('/0810-faultline-front/assets/models/unit.glb');
  });

  it('uses the site root when the supplied base is empty', () => {
    expect(resolvePublicAssetUrl('', 'assets/models/unit.glb'))
      .toBe('/assets/models/unit.glb');
  });
});
