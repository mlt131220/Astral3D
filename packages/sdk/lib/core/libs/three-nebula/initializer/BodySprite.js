import _defineProperty from "@babel/runtime/helpers/defineProperty";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) { symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); } keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

import { DEFAULT_JSON_MATERIAL_PROPERTIES, DEFAULT_MATERIAL_PROPERTIES, SUPPORTED_MATERIAL_BLENDING_MODES } from './constants';
import { normalizeMaterialBlending } from '@/utils/scene/blending';
import Initializer from './Initializer';
import { INITIALIZER_TYPE_BODY_SPRITE as type } from './types';
import { withDefaults } from '../utils';
/**
 * Sets the body property to be a THREE.Sprite on initialized particles.
 *
 * NOTE The texture map MUST be set on the SpriteMaterial in the TextureLoader.load
 * callback. Not doing so will cause WebGL buffer errors.
 */

export default class BodySprite extends Initializer {
  /**
   * Constructs a BodySprite initializer.
   *
   * @param {object} THREE - The Web GL API we are using eg., THREE
   * @param {string} texture - The sprite texture
   * @param {object} materialProperties - The sprite material properties
   * @throws {Error} If the TextureLoader fails to load the supplied texture
   * @return void
   */
  constructor(THREE, texture, materialProperties = DEFAULT_MATERIAL_PROPERTIES, isEnabled = true) {
    super(type, isEnabled);
    const {
      Sprite,
      SpriteMaterial,
      TextureLoader
    } = THREE;
    /**
     * @desc The material properties for this object's SpriteMaterial
     * NOTE This is required for testing purposes
     * @type {object}
     */

    this.materialProperties = withDefaults(DEFAULT_MATERIAL_PROPERTIES, materialProperties);
    new TextureLoader().load(texture, map => {
      /**
       * @desc The texture for the THREE.SpriteMaterial map.
       * @type {Texture}
       */
      this.texture = map;
      /**
       * @desc THREE.SpriteMaterial instance.
       * @type {SpriteMaterial}
       */

      this.material = normalizeMaterialBlending(new SpriteMaterial(_objectSpread(_objectSpread({}, {
        map
      }), this.materialProperties)));
      /**
       * @desc THREE.Sprite instance.
       * @type {Sprite}
       */

      this.sprite = new Sprite(this.material);
    }, undefined, error => {
      throw new Error(error);
    });
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
   * Creates a BodySprite initializer from JSON.
   *
   * @param {object} json - The JSON to construct the instance from
   * @param {object} THREE - The Web GL API we are using eg., THREE
   * @param {string} json.texture - The sprite texture
   * @param {object} json.materialProperties - The sprite material properties
   * @return {BodySprite}
   */


  static fromJSON(json, THREE) {
    const {
      texture,
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

    return new BodySprite(THREE, texture, withDefaults(DEFAULT_JSON_MATERIAL_PROPERTIES, ensureMappedBlendingMode(materialProperties)), isEnabled);
  }

}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbml0aWFsaXplci9Cb2R5U3ByaXRlLmpzIl0sIm5hbWVzIjpbIkRFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTIiwiREVGQVVMVF9NQVRFUklBTF9QUk9QRVJUSUVTIiwiU1VQUE9SVEVEX01BVEVSSUFMX0JMRU5ESU5HX01PREVTIiwiSW5pdGlhbGl6ZXIiLCJJTklUSUFMSVpFUl9UWVBFX0JPRFlfU1BSSVRFIiwidHlwZSIsIndpdGhEZWZhdWx0cyIsIkJvZHlTcHJpdGUiLCJjb25zdHJ1Y3RvciIsIlRIUkVFIiwidGV4dHVyZSIsIm1hdGVyaWFsUHJvcGVydGllcyIsImlzRW5hYmxlZCIsIlNwcml0ZSIsIlNwcml0ZU1hdGVyaWFsIiwiVGV4dHVyZUxvYWRlciIsImxvYWQiLCJtYXAiLCJtYXRlcmlhbCIsInNwcml0ZSIsInVuZGVmaW5lZCIsImVycm9yIiwiRXJyb3IiLCJpbml0aWFsaXplIiwicGFydGljbGUiLCJib2R5IiwiZnJvbUpTT04iLCJqc29uIiwiZW5zdXJlTWFwcGVkQmxlbmRpbmdNb2RlIiwicHJvcGVydGllcyIsImJsZW5kaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxTQUNFQSxnQ0FERixFQUVFQywyQkFGRixFQUdFQyxpQ0FIRixRQUlPLGFBSlA7QUFNQSxPQUFPQyxXQUFQLE1BQXdCLGVBQXhCO0FBQ0EsU0FBU0MsNEJBQTRCLElBQUlDLElBQXpDLFFBQXFELFNBQXJEO0FBQ0EsU0FBU0MsWUFBVCxRQUE2QixVQUE3QjtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQSxlQUFlLE1BQU1DLFVBQU4sU0FBeUJKLFdBQXpCLENBQXFDO0FBQ2xEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNFSyxFQUFBQSxXQUFXLENBQ1RDLEtBRFMsRUFFVEMsT0FGUyxFQUdUQyxrQkFBa0IsR0FBR1YsMkJBSFosRUFJVFcsU0FBUyxHQUFHLElBSkgsRUFLVDtBQUNBLFVBQU1QLElBQU4sRUFBWU8sU0FBWjtBQUVBLFVBQU07QUFBRUMsTUFBQUEsTUFBRjtBQUFVQyxNQUFBQSxjQUFWO0FBQTBCQyxNQUFBQTtBQUExQixRQUE0Q04sS0FBbEQ7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUNJLFNBQUtFLGtCQUFMLEdBQTBCTCxZQUFZLENBQ3BDTCwyQkFEb0MsRUFFcENVLGtCQUZvQyxDQUF0QztBQUtBLFFBQUlJLGFBQUosR0FBb0JDLElBQXBCLENBQ0VOLE9BREYsRUFFRU8sR0FBRyxJQUFJO0FBQ0w7QUFDUjtBQUNBO0FBQ0E7QUFDUSxXQUFLUCxPQUFMLEdBQWVPLEdBQWY7QUFFQTtBQUNSO0FBQ0E7QUFDQTs7QUFDUSxXQUFLQyxRQUFMLEdBQWdCLElBQUlKLGNBQUosaUNBQ1g7QUFBRUcsUUFBQUE7QUFBRixPQURXLEdBRVgsS0FBS04sa0JBRk0sRUFBaEI7QUFLQTtBQUNSO0FBQ0E7QUFDQTs7QUFDUSxXQUFLUSxNQUFMLEdBQWMsSUFBSU4sTUFBSixDQUFXLEtBQUtLLFFBQWhCLENBQWQ7QUFDRCxLQXZCSCxFQXdCRUUsU0F4QkYsRUF5QkVDLEtBQUssSUFBSTtBQUNQLFlBQU0sSUFBSUMsS0FBSixDQUFVRCxLQUFWLENBQU47QUFDRCxLQTNCSDtBQTZCRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ0VFLEVBQUFBLFVBQVUsQ0FBQ0MsUUFBRCxFQUFXO0FBQ25CQSxJQUFBQSxRQUFRLENBQUNDLElBQVQsR0FBZ0IsS0FBS04sTUFBckI7QUFDRDtBQUVEO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FBQ2lCLFNBQVJPLFFBQVEsQ0FBQ0MsSUFBRCxFQUFPbEIsS0FBUCxFQUFjO0FBQzNCLFVBQU07QUFDSkMsTUFBQUEsT0FESTtBQUVKQyxNQUFBQSxrQkFBa0IsR0FBR1gsZ0NBRmpCO0FBR0pZLE1BQUFBLFNBQVMsR0FBRztBQUhSLFFBSUZlLElBSko7O0FBTUEsVUFBTUMsd0JBQXdCLEdBQUdDLFVBQVUsSUFBSTtBQUM3QyxZQUFNO0FBQUVDLFFBQUFBO0FBQUYsVUFBZUQsVUFBckI7QUFFQSw2Q0FDS0EsVUFETDtBQUVFQyxRQUFBQSxRQUFRLEVBQUVBLFFBQVEsR0FDZDVCLGlDQUFpQyxDQUFDNEIsUUFBRCxDQURuQixHQUVkNUIsaUNBQWlDLENBQ2pDRixnQ0FBZ0MsQ0FBQzhCLFFBREE7QUFKdkM7QUFRRCxLQVhEOztBQWFBLFdBQU8sSUFBSXZCLFVBQUosQ0FDTEUsS0FESyxFQUVMQyxPQUZLLEVBR0xKLFlBQVksQ0FDVk4sZ0NBRFUsRUFFVjRCLHdCQUF3QixDQUFDakIsa0JBQUQsQ0FGZCxDQUhQLEVBT0xDLFNBUEssQ0FBUDtBQVNEOztBQTdHaUQiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBERUZBVUxUX0pTT05fTUFURVJJQUxfUFJPUEVSVElFUyxcbiAgREVGQVVMVF9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICBTVVBQT1JURURfTUFURVJJQUxfQkxFTkRJTkdfTU9ERVMsXG59IGZyb20gJy4vY29uc3RhbnRzJztcblxuaW1wb3J0IEluaXRpYWxpemVyIGZyb20gJy4vSW5pdGlhbGl6ZXInO1xuaW1wb3J0IHsgSU5JVElBTElaRVJfVFlQRV9CT0RZX1NQUklURSBhcyB0eXBlIH0gZnJvbSAnLi90eXBlcyc7XG5pbXBvcnQgeyB3aXRoRGVmYXVsdHMgfSBmcm9tICcuLi91dGlscyc7XG5cbi8qKlxuICogU2V0cyB0aGUgYm9keSBwcm9wZXJ0eSB0byBiZSBhIFRIUkVFLlNwcml0ZSBvbiBpbml0aWFsaXplZCBwYXJ0aWNsZXMuXG4gKlxuICogTk9URSBUaGUgdGV4dHVyZSBtYXAgTVVTVCBiZSBzZXQgb24gdGhlIFNwcml0ZU1hdGVyaWFsIGluIHRoZSBUZXh0dXJlTG9hZGVyLmxvYWRcbiAqIGNhbGxiYWNrLiBOb3QgZG9pbmcgc28gd2lsbCBjYXVzZSBXZWJHTCBidWZmZXIgZXJyb3JzLlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBCb2R5U3ByaXRlIGV4dGVuZHMgSW5pdGlhbGl6ZXIge1xuICAvKipcbiAgICogQ29uc3RydWN0cyBhIEJvZHlTcHJpdGUgaW5pdGlhbGl6ZXIuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBUSFJFRSAtIFRoZSBXZWIgR0wgQVBJIHdlIGFyZSB1c2luZyBlZy4sIFRIUkVFXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0dXJlIC0gVGhlIHNwcml0ZSB0ZXh0dXJlXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBtYXRlcmlhbFByb3BlcnRpZXMgLSBUaGUgc3ByaXRlIG1hdGVyaWFsIHByb3BlcnRpZXNcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSBUZXh0dXJlTG9hZGVyIGZhaWxzIHRvIGxvYWQgdGhlIHN1cHBsaWVkIHRleHR1cmVcbiAgICogQHJldHVybiB2b2lkXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBUSFJFRSxcbiAgICB0ZXh0dXJlLFxuICAgIG1hdGVyaWFsUHJvcGVydGllcyA9IERFRkFVTFRfTUFURVJJQUxfUFJPUEVSVElFUyxcbiAgICBpc0VuYWJsZWQgPSB0cnVlXG4gICkge1xuICAgIHN1cGVyKHR5cGUsIGlzRW5hYmxlZCk7XG5cbiAgICBjb25zdCB7IFNwcml0ZSwgU3ByaXRlTWF0ZXJpYWwsIFRleHR1cmVMb2FkZXIgfSA9IFRIUkVFO1xuXG4gICAgLyoqXG4gICAgICogQGRlc2MgVGhlIG1hdGVyaWFsIHByb3BlcnRpZXMgZm9yIHRoaXMgb2JqZWN0J3MgU3ByaXRlTWF0ZXJpYWxcbiAgICAgKiBOT1RFIFRoaXMgaXMgcmVxdWlyZWQgZm9yIHRlc3RpbmcgcHVycG9zZXNcbiAgICAgKiBAdHlwZSB7b2JqZWN0fVxuICAgICAqL1xuICAgIHRoaXMubWF0ZXJpYWxQcm9wZXJ0aWVzID0gd2l0aERlZmF1bHRzKFxuICAgICAgREVGQVVMVF9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgbWF0ZXJpYWxQcm9wZXJ0aWVzXG4gICAgKTtcblxuICAgIG5ldyBUZXh0dXJlTG9hZGVyKCkubG9hZChcbiAgICAgIHRleHR1cmUsXG4gICAgICBtYXAgPT4ge1xuICAgICAgICAvKipcbiAgICAgICAgICogQGRlc2MgVGhlIHRleHR1cmUgZm9yIHRoZSBUSFJFRS5TcHJpdGVNYXRlcmlhbCBtYXAuXG4gICAgICAgICAqIEB0eXBlIHtUZXh0dXJlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50ZXh0dXJlID0gbWFwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAZGVzYyBUSFJFRS5TcHJpdGVNYXRlcmlhbCBpbnN0YW5jZS5cbiAgICAgICAgICogQHR5cGUge1Nwcml0ZU1hdGVyaWFsfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG5ldyBTcHJpdGVNYXRlcmlhbCh7XG4gICAgICAgICAgLi4ueyBtYXAgfSxcbiAgICAgICAgICAuLi50aGlzLm1hdGVyaWFsUHJvcGVydGllcyxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEBkZXNjIFRIUkVFLlNwcml0ZSBpbnN0YW5jZS5cbiAgICAgICAgICogQHR5cGUge1Nwcml0ZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3ByaXRlID0gbmV3IFNwcml0ZSh0aGlzLm1hdGVyaWFsKTtcbiAgICAgIH0sXG4gICAgICB1bmRlZmluZWQsXG4gICAgICBlcnJvciA9PiB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcik7XG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwYXJ0aWNsZSBib2R5IHRvIHRoZSBzcHJpdGUuXG4gICAqXG4gICAqIEBwYXJhbSB7UGFydGljbGV9IHBhcnRpY2xlIC0gVGhlIHBhcnRpY2xlIHRvIHNldCB0aGUgYm9keSBvZlxuICAgKiBAcmV0dXJuIHZvaWRcbiAgICovXG4gIGluaXRpYWxpemUocGFydGljbGUpIHtcbiAgICBwYXJ0aWNsZS5ib2R5ID0gdGhpcy5zcHJpdGU7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIEJvZHlTcHJpdGUgaW5pdGlhbGl6ZXIgZnJvbSBKU09OLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0ganNvbiAtIFRoZSBKU09OIHRvIGNvbnN0cnVjdCB0aGUgaW5zdGFuY2UgZnJvbVxuICAgKiBAcGFyYW0ge29iamVjdH0gVEhSRUUgLSBUaGUgV2ViIEdMIEFQSSB3ZSBhcmUgdXNpbmcgZWcuLCBUSFJFRVxuICAgKiBAcGFyYW0ge3N0cmluZ30ganNvbi50ZXh0dXJlIC0gVGhlIHNwcml0ZSB0ZXh0dXJlXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBqc29uLm1hdGVyaWFsUHJvcGVydGllcyAtIFRoZSBzcHJpdGUgbWF0ZXJpYWwgcHJvcGVydGllc1xuICAgKiBAcmV0dXJuIHtCb2R5U3ByaXRlfVxuICAgKi9cbiAgc3RhdGljIGZyb21KU09OKGpzb24sIFRIUkVFKSB7XG4gICAgY29uc3Qge1xuICAgICAgdGV4dHVyZSxcbiAgICAgIG1hdGVyaWFsUHJvcGVydGllcyA9IERFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgaXNFbmFibGVkID0gdHJ1ZSxcbiAgICB9ID0ganNvbjtcblxuICAgIGNvbnN0IGVuc3VyZU1hcHBlZEJsZW5kaW5nTW9kZSA9IHByb3BlcnRpZXMgPT4ge1xuICAgICAgY29uc3QgeyBibGVuZGluZyB9ID0gcHJvcGVydGllcztcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgLi4ucHJvcGVydGllcyxcbiAgICAgICAgYmxlbmRpbmc6IGJsZW5kaW5nXG4gICAgICAgICAgPyBTVVBQT1JURURfTUFURVJJQUxfQkxFTkRJTkdfTU9ERVNbYmxlbmRpbmddXG4gICAgICAgICAgOiBTVVBQT1JURURfTUFURVJJQUxfQkxFTkRJTkdfTU9ERVNbXG4gICAgICAgICAgICBERUZBVUxUX0pTT05fTUFURVJJQUxfUFJPUEVSVElFUy5ibGVuZGluZ1xuICAgICAgICAgIF0sXG4gICAgICB9O1xuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IEJvZHlTcHJpdGUoXG4gICAgICBUSFJFRSxcbiAgICAgIHRleHR1cmUsXG4gICAgICB3aXRoRGVmYXVsdHMoXG4gICAgICAgIERFRkFVTFRfSlNPTl9NQVRFUklBTF9QUk9QRVJUSUVTLFxuICAgICAgICBlbnN1cmVNYXBwZWRCbGVuZGluZ01vZGUobWF0ZXJpYWxQcm9wZXJ0aWVzKVxuICAgICAgKSxcbiAgICAgIGlzRW5hYmxlZFxuICAgICk7XG4gIH1cbn1cbiJdfQ==
