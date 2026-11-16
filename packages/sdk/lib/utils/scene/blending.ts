import { MultiplyBlending, SubtractiveBlending } from "three";
import type { Material } from "three";

const forcedPremultiplication = new WeakSet<Material>();

export function getConfiguredPremultipliedAlpha(material: Material): boolean {
    return material.premultipliedAlpha && !forcedPremultiplication.has(material);
}

export function normalizeMaterialBlending<T extends Material>(
    material: T,
    configuredAlpha = getConfiguredPremultipliedAlpha(material)
): T {
    const requiresPremultiplication = material.blending === MultiplyBlending || material.blending === SubtractiveBlending;
    if (requiresPremultiplication && !configuredAlpha) {
        forcedPremultiplication.add(material);
    } else {
        forcedPremultiplication.delete(material);
    }

    const renderAlpha = configuredAlpha || requiresPremultiplication;
    if (material.premultipliedAlpha !== renderAlpha) {
        material.premultipliedAlpha = renderAlpha;
        material.needsUpdate = true;
    }
    return material;
}

export function serializeMaterial(material: Material, meta?: Parameters<Material["toJSON"]>[0]) {
    const json = material.toJSON(meta);
    // 场景保存用户设置，载入时再根据混合模式启用渲染兼容。
    json.premultipliedAlpha = getConfiguredPremultipliedAlpha(material);
    return json;
}
