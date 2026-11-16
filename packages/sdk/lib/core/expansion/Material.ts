import { Material } from "three";
import { getConfiguredPremultipliedAlpha, normalizeMaterialBlending } from "@/utils/scene/blending";

/**
 * 从另一个材质中复制相同的属性（材质类型可能不同）
 * @param source - 用于被复制属性的材质，属性为引用
 */
Material.prototype.copyAttr = function (source) {
    if (!source.isMaterial) return;

    Object.keys(source).forEach(key => {
        if (this.hasOwnProperty(key)){
            this[key] = source[key];
        }
    })
    normalizeMaterialBlending(this, getConfiguredPremultipliedAlpha(source));
}
