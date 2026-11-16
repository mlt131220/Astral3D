import _defineProperty from "@babel/runtime/helpers/defineProperty";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

import { DEFAULT_JSON_MATERIAL_PROPERTIES, DEFAULT_MATERIAL_PROPERTIES, SUPPORTED_MATERIAL_BLENDING_MODES } from './constants';
import { normalizeMaterialBlending } from '@/utils/scene/blending';
import Initializer from './Initializer';
import { INITIALIZER_TYPE_TEXTURE as type } from './types';
import { withDefaults } from '../utils';
/**
 * Sets the body property to be a THREE.Sprite with a texture map on initialized particles.
 *
 */

export default class Texture extends Initializer {
  /**
   * Constructs an Texture initializer.
   *
   * @param {object} THREE - The Web GL API we are using eg., THREE
   * @param {string} texture - The sprite texture
   * @param {object|undefined} materialProperties - The sprite material properties
   * @param {?Texture} loadedTexture - Preloaded THREE.Texture instance
   */
  constructor(THREE, loadedTexture, materialProperties = DEFAULT_MATERIAL_PROPERTIES, isEnabled = true) {
    super(type, isEnabled);
    const {
      Sprite,
      SpriteMaterial
    } = THREE;
    /**
     * @desc The material properties for this object's SpriteMaterial
     * NOTE This is required for testing purposes
     * @type {object}
     */

    this.materialProperties = withDefaults(DEFAULT_MATERIAL_PROPERTIES, materialProperties);
    /**
     * @desc The texture for the THREE.SpriteMaterial map.
     * @type {Texture}
     */

    this.texture = loadedTexture;
    /**
     * @desc THREE.SpriteMaterial instance.
     * @type {SpriteMaterial}
     */

    this.material = normalizeMaterialBlending(new SpriteMaterial(_objectSpread(_objectSpread({}, {
      map: loadedTexture
    }), this.materialProperties)));
    /**
     * @desc THREE.Sprite instance.
     * @type {Sprite}
     */

    this.sprite = new Sprite(this.material);
  }
  /**
   * Sets the particle body to the sprite.
   *
   * @param {Particle} particle - The particle to set the body of
   * @return void
   */


  initialize(particle) {
    particle.body = this.sprite;
  }
  /**
   * Creates a Texture initializer from JSON.
   *
   * @param {object} json - The JSON to construct the instance from
   * @param {object} THREE - The Web GL API we are using eg., THREE
   * @param {Texture} json.loadedTexture - The loaded sprite texture
   * @param {object} json.materialProperties - The sprite material properties
   * @return {BodySprite}
   */


  static fromJSON(json, THREE) {
    const {
      loadedTexture,
      materialProperties = DEFAULT_JSON_MATERIAL_PROPERTIES,
      isEnabled = true
    } = json;

    const ensureMappedBlendingMode = properties => {
      const {
        blending
      } = properties;
      return _objectSpread(_objectSpread({}, properties), {}, {
        blending: blending ? SUPPORTED_MATERIAL_BLENDING_MODES[blending] : SUPPORTED_MATERIAL_BLENDING_MODES[DEFAULT_JSON_MATERIAL_PROPERTIES.blending]
      });
    };

    return new Texture(THREE, loadedTexture, withDefaults(DEFAULT_JSON_MATERIAL_PROPERTIES, ensureMappedBlendingMode(materialProperties)), isEnabled);
  }

}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbml0aWFsaXplci9UZXh0dXJlLmpzIl0sIm5hbWVzIjpbIkRFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTIiwiREVGQVVMVF9NQVRFUklBTF9QUk9QRVJUSUVTIiwiU1VQUE9SVEVEX01BVEVSSUFMX0JMRU5ESU5HX01PREVTIiwiSW5pdGlhbGl6ZXIiLCJJTklUSUFMSVpFUl9UWVBFX1RFWFRVUkUiLCJ0eXBlIiwid2l0aERlZmF1bHRzIiwiVGV4dHVyZSIsImNvbnN0cnVjdG9yIiwiVEhSRUUiLCJsb2FkZWRUZXh0dXJlIiwibWF0ZXJpYWxQcm9wZXJ0aWVzIiwiaXNFbmFibGVkIiwiU3ByaXRlIiwiU3ByaXRlTWF0ZXJpYWwiLCJ0ZXh0dXJlIiwibWF0ZXJpYWwiLCJtYXAiLCJzcHJpdGUiLCJpbml0aWFsaXplIiwicGFydGljbGUiLCJib2R5IiwiZnJvbUpTT04iLCJqc29uIiwiZW5zdXJlTWFwcGVkQmxlbmRpbmdNb2RlIiwicHJvcGVydGllcyIsImJsZW5kaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxTQUNFQSxnQ0FERixFQUVFQywyQkFGRixFQUdFQyxpQ0FIRixRQUlPLGFBSlA7QUFNQSxPQUFPQyxXQUFQLE1BQXdCLGVBQXhCO0FBQ0EsU0FBU0Msd0JBQXdCLElBQUlDLElBQXJDLFFBQWlELFNBQWpEO0FBQ0EsU0FBU0MsWUFBVCxRQUE2QixVQUE3QjtBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUNBLGVBQWUsTUFBTUMsT0FBTixTQUFzQkosV0FBdEIsQ0FBa0M7QUFDL0M7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFSyxFQUFBQSxXQUFXLENBQ1RDLEtBRFMsRUFFVEMsYUFGUyxFQUdUQyxrQkFBa0IsR0FBR1YsMkJBSFosRUFJVFcsU0FBUyxHQUFHLElBSkgsRUFLVDtBQUNBLFVBQU1QLElBQU4sRUFBWU8sU0FBWjtBQUVBLFVBQU07QUFBRUMsTUFBQUEsTUFBRjtBQUFVQyxNQUFBQTtBQUFWLFFBQTZCTCxLQUFuQztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBQ0ksU0FBS0Usa0JBQUwsR0FBMEJMLFlBQVksQ0FDcENMLDJCQURvQyxFQUVwQ1Usa0JBRm9DLENBQXRDO0FBS0E7QUFDSjtBQUNBO0FBQ0E7O0FBQ0ksU0FBS0ksT0FBTCxHQUFlTCxhQUFmO0FBRUE7QUFDSjtBQUNBO0FBQ0E7O0FBQ0ksU0FBS00sUUFBTCxHQUFnQixJQUFJRixjQUFKLGlDQUNYO0FBQUVHLE1BQUFBLEdBQUcsRUFBRVA7QUFBUCxLQURXLEdBRVgsS0FBS0Msa0JBRk0sRUFBaEI7QUFLQTtBQUNKO0FBQ0E7QUFDQTs7QUFDSSxTQUFLTyxNQUFMLEdBQWMsSUFBSUwsTUFBSixDQUFXLEtBQUtHLFFBQWhCLENBQWQ7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VHLEVBQUFBLFVBQVUsQ0FBQ0MsUUFBRCxFQUFXO0FBQ25CQSxJQUFBQSxRQUFRLENBQUNDLElBQVQsR0FBZ0IsS0FBS0gsTUFBckI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ2lCLFNBQVJJLFFBQVEsQ0FBQ0MsSUFBRCxFQUFPZCxLQUFQLEVBQWM7QUFDM0IsVUFBTTtBQUNKQyxNQUFBQSxhQURJO0FBRUpDLE1BQUFBLGtCQUFrQixHQUFHWCxnQ0FGakI7QUFHSlksTUFBQUEsU0FBUyxHQUFHO0FBSFIsUUFJRlcsSUFKSjs7QUFNQSxVQUFNQyx3QkFBd0IsR0FBR0MsVUFBVSxJQUFJO0FBQzdDLFlBQU07QUFBRUMsUUFBQUE7QUFBRixVQUFlRCxVQUFyQjtBQUVBLDZDQUNLQSxVQURMO0FBRUVDLFFBQUFBLFFBQVEsRUFBRUEsUUFBUSxHQUNkeEIsaUNBQWlDLENBQUN3QixRQUFELENBRG5CLEdBRWR4QixpQ0FBaUMsQ0FDakNGLGdDQUFnQyxDQUFDMEIsUUFEQTtBQUp2QztBQVFELEtBWEQ7O0FBYUEsV0FBTyxJQUFJbkIsT0FBSixDQUNMRSxLQURLLEVBRUxDLGFBRkssRUFHTEosWUFBWSxDQUNWTixnQ0FEVSxFQUVWd0Isd0JBQXdCLENBQUNiLGtCQUFELENBRmQsQ0FIUCxFQU9MQyxTQVBLLENBQVA7QUFTRDs7QUFuRzhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtcbiAgREVGQVVMVF9KU09OX01BVEVSSUFMX1BST1BFUlRJRVMsXG4gIERFRkFVTFRfTUFURVJJQUxfUFJPUEVSVElFUyxcbiAgU1VQUE9SVEVEX01BVEVSSUFMX0JMRU5ESU5HX01PREVTLFxufSBmcm9tICcuL2NvbnN0YW50cyc7XG5cbmltcG9ydCBJbml0aWFsaXplciBmcm9tICcuL0luaXRpYWxpemVyJztcbmltcG9ydCB7IElOSVRJQUxJWkVSX1RZUEVfVEVYVFVSRSBhcyB0eXBlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyB3aXRoRGVmYXVsdHMgfSBmcm9tICcuLi91dGlscyc7XG5cbi8qKlxuICogU2V0cyB0aGUgYm9keSBwcm9wZXJ0eSB0byBiZSBhIFRIUkVFLlNwcml0ZSB3aXRoIGEgdGV4dHVyZSBtYXAgb24gaW5pdGlhbGl6ZWQgcGFydGljbGVzLlxuICpcbiAqL1xuZXhwb3J0IGRlZmF1bHQgY2xhc3MgVGV4dHVyZSBleHRlbmRzIEluaXRpYWxpemVyIHtcbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYW4gVGV4dHVyZSBpbml0aWFsaXplci5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IFRIUkVFIC0gVGhlIFdlYiBHTCBBUEkgd2UgYXJlIHVzaW5nIGVnLiwgVEhSRUVcbiAgICogQHBhcmFtIHtzdHJpbmd9IHRleHR1cmUgLSBUaGUgc3ByaXRlIHRleHR1cmVcbiAgICogQHBhcmFtIHtvYmplY3R8dW5kZWZpbmVkfSBtYXRlcmlhbFByb3BlcnRpZXMgLSBUaGUgc3ByaXRlIG1hdGVyaWFsIHByb3BlcnRpZXNcbiAgICogQHBhcmFtIHs/VGV4dHVyZX0gbG9hZGVkVGV4dHVyZSAtIFByZWxvYWRlZCBUSFJFRS5UZXh0dXJlIGluc3RhbmNlXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBUSFJFRSxcbiAgICBsb2FkZWRUZXh0dXJlLFxuICAgIG1hdGVyaWFsUHJvcGVydGllcyA9IERFRkFVTFRfTUFURVJJQUxfUFJPUEVSVElFUyxcbiAgICBpc0VuYWJsZWQgPSB0cnVlXG4gICkge1xuICAgIHN1cGVyKHR5cGUsIGlzRW5hYmxlZCk7XG5cbiAgICBjb25zdCB7IFNwcml0ZSwgU3ByaXRlTWF0ZXJpYWwgfSA9IFRIUkVFO1xuXG4gICAgLyoqXG4gICAgICogQGRlc2MgVGhlIG1hdGVyaWFsIHByb3BlcnRpZXMgZm9yIHRoaXMgb2JqZWN0J3MgU3ByaXRlTWF0ZXJpYWxcbiAgICAgKiBOT1RFIFRoaXMgaXMgcmVxdWlyZWQgZm9yIHRlc3RpbmcgcHVycG9zZXNcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMubWF0ZXJpYWxQcm9wZXJ0aWVzID0gd2l0aERlZmF1bHRzKFxuICAgICAgREVGQVVMVF9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgbWF0ZXJpYWxQcm9wZXJ0aWVzXG4gICAgKTtcblxuICAgIC8qKlxuICAgICAqIEBkZXNjIFRoZSB0ZXh0dXJlIGZvciB0aGUgVEhSRUUuU3ByaXRlTWF0ZXJpYWwgbWFwLlxuICAgICAqIEB0eXBlIHtUZXh0dXJlfVxuICAgICAqL1xuICAgIHRoaXMudGV4dHVyZSA9IGxvYWRlZFRleHR1cmU7XG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBUSFJFRS5TcHJpdGVNYXRlcmlhbCBpbnN0YW5jZS5cbiAgICAgKiBAdHlwZSB7U3ByaXRlTWF0ZXJpYWx9XG4gICAgICovXG4gICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBTcHJpdGVNYXRlcmlhbCh7XG4gICAgICAuLi57IG1hcDogbG9hZGVkVGV4dHVyZSB9LFxuICAgICAgLi4udGhpcy5tYXRlcmlhbFByb3BlcnRpZXMsXG4gICAgfSk7XG5cbiAgICAvKipcbiAgICAgKiBAZGVzYyBUSFJFRS5TcHJpdGUgaW5zdGFuY2UuXG4gICAgICogQHR5cGUge1Nwcml0ZX1cbiAgICAgKi9cbiAgICB0aGlzLnNwcml0ZSA9IG5ldyBTcHJpdGUodGhpcy5tYXRlcmlhbCk7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGFydGljbGUgYm9keSB0byB0aGUgc3ByaXRlLlxuICAgKlxuICAgKiBAcGFyYW0ge1BhcnRpY2xlfSBwYXJ0aWNsZSAtIFRoZSBwYXJ0aWNsZSB0byBzZXQgdGhlIGJvZHkgb2ZcbiAgICogQHJldHVybiB2b2lkXG4gICAqL1xuICBpbml0aWFsaXplKHBhcnRpY2xlKSB7XG4gICAgcGFydGljbGUuYm9keSA9IHRoaXMuc3ByaXRlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBUZXh0dXJlIGluaXRpYWxpemVyIGZyb20gSlNPTi5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IGpzb24gLSBUaGUgSlNPTiB0byBjb25zdHJ1Y3QgdGhlIGluc3RhbmNlIGZyb21cbiAgICogQHBhcmFtIHtvYmplY3R9IFRIUkVFIC0gVGhlIFdlYiBHTCBBUEkgd2UgYXJlIHVzaW5nIGVnLiwgVEhSRUVcbiAgICogQHBhcmFtIHtUZXh0dXJlfSBqc29uLmxvYWRlZFRleHR1cmUgLSBUaGUgbG9hZGVkIHNwcml0ZSB0ZXh0dXJlXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uLm1hdGVyaWFsUHJvcGVydGllcyAtIFRoZSBzcHJpdGUgbWF0ZXJpYWwgcHJvcGVydGllc1xuICAgKiBAcmV0dXJuIHtCb2R5U3ByaXRlfVxuICAgKi9cbiAgc3RhdGljIGZyb21KU09OKGpzb24sIFRIUkVFKSB7XG4gICAgY29uc3Qge1xuICAgICAgbG9hZGVkVGV4dHVyZSxcbiAgICAgIG1hdGVyaWFsUHJvcGVydGllcyA9IERFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgaXNFbmFibGVkID0gdHJ1ZSxcbiAgICB9ID0ganNvbjtcblxuICAgIGNvbnN0IGVuc3VyZU1hcHBlZEJsZW5kaW5nTW9kZSA9IHByb3BlcnRpZXMgPT4ge1xuICAgICAgY29uc3QgeyBibGVuZGluZyB9ID0gcHJvcGVydGllcztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucHJvcGVydGllcyxcbiAgICAgICAgYmxlbmRpbmc6IGJsZW5kaW5nXG4gICAgICAgICAgPyBTVVBQT1JURURfTUFURVJJQUxfQkxFTkRJTkdfTU9ERVNbYmxlbmRpbmddXG4gICAgICAgICAgOiBTVVBQT1JURURfTUFURVJJQUxfQkxFTkRJTkdfTU9ERVNbXG4gICAgICAgICAgICBERUZBVUxUX0pTT05fTUFURVJJQUxfUFJPUEVSVElFUy5ibGVuZGluZ1xuICAgICAgICAgIF0sXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFRleHR1cmUoXG4gICAgICBUSFJFRSxcbiAgICAgIGxvYWRlZFRleHR1cmUsXG4gICAgICB3aXRoRGVmYXVsdHMoXG4gICAgICAgIERFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgICBlbnN1cmVNYXBwZWRCbGVuZGluZ01vZGUobWF0ZXJpYWxQcm9wZXJ0aWVzKVxuICAgICAgKSxcbiAgICAgIGlzRW5hYmxlZFxuICAgICk7XG4gIH1cbn1cbiJdfQ==
