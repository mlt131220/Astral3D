import * as THREE from 'three';
import Loader from "#/core/loader/Loader";

class Resource {
    constructor() { }

    loadURLTexture(url: string | THREE.Texture, onload: (tex: THREE.Texture) => void = () => { }, onerror: (err: any) => void = () => { }) {
        if (url instanceof THREE.Texture) {
            onload(url);
            return url;
        }

        const extension = url.split(".").pop()?.toLowerCase() as string;
        return Loader.loadUrlTexture(extension, url, onload, onerror);
    }
}

export { Resource };