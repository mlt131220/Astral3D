import * as THREE from 'three';

export const TYPED_ARRAYS = {
    Int8Array: Int8Array,
    Uint8Array: Uint8Array,
    Uint8ClampedArray: Uint8ClampedArray,
    Int16Array: Int16Array,
    Uint16Array: Uint16Array,
    Int32Array: Int32Array,
    Uint32Array: Uint32Array,
    Float32Array: Float32Array,
    Float64Array: Float64Array
};

// base64对应的类型
export const BASE64_TYPES = {
    "data:image/png;base64": "png",
    "data:image/jpeg;base64": "jpg",
    "data:image/gif;base64": "gif",
    "data:image/x-icon;base64": "ico",
    "data:image/svg+xml;base64": "svg",
    "data:image/webp;base64": "webp",
    "data:audio/wav;base64": "wav",
    "data:audio/mpeg;base64": "mp3",
    "data:video/mp4;base64": "mp4",
    "data:video/webm;base64": "webm",
    "data:font/woff;base64": "woff",
    "data:font/woff2;base64": "woff2",
    "data:application/vnd.ms-fontobject;base64": "eot",
    "data:application/x-font-ttf;base64": "ttf",
    "data:application/octet-stream;base64": "ttf",
    "data:application/font-woff;base64": "woff",
    "data:application/font-woff2;base64": "woff2"
}

export const TEXTURE_MAPPING = {
    UVMapping: THREE.UVMapping,
    CubeReflectionMapping: THREE.CubeReflectionMapping,
    CubeRefractionMapping: THREE.CubeRefractionMapping,
    EquirectangularReflectionMapping: THREE.EquirectangularReflectionMapping,
    EquirectangularRefractionMapping: THREE.EquirectangularRefractionMapping
};

export const TEXTURE_WRAPPING = {
    RepeatWrapping: THREE.RepeatWrapping,
    ClampToEdgeWrapping: THREE.ClampToEdgeWrapping,
    MirroredRepeatWrapping: THREE.MirroredRepeatWrapping
};

export const TEXTURE_FILTER = {
    NearestFilter: THREE.NearestFilter,
    NearestMipmapNearestFilter: THREE.NearestMipmapNearestFilter,
    NearestMipmapLinearFilter: THREE.NearestMipmapLinearFilter,
    LinearFilter: THREE.LinearFilter,
    LinearMipmapNearestFilter: THREE.LinearMipmapNearestFilter,
    LinearMipmapLinearFilter: THREE.LinearMipmapLinearFilter
};
