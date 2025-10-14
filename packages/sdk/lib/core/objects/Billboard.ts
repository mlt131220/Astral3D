/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/4/6 12:02
 * @description 广告牌对象
 */
import * as THREE from 'three'
import { POSITION } from "#/constant";
import BillboardTexture from "./texture/BillboardTexture";
import { deepAssign } from "#/utils";

export interface BillboardEventMap extends THREE.Object3DEventMap {
    imgLoaded: { url: string };

    redraw: { url: string }
}

export const getDefaultBillboardOptions = () => ({
    name: "Billboard",
    position: [0, 0, 0],
    image: {
        // 图像地址
        url: '',
        // 可见性
        visible: false,
        // 宽度
        width: 32,
        // 高度
        height: 32,
        // 旋转角度 deg
        rotate: 0,
        // 与文本的间距
        margin: 2,
        // 位置
        position: POSITION.CENTER,
        // 置顶
        top: false,
    },
    text: {
        // 内容
        value: '',
        // 可见性
        visible: false,
        // 字体大小
        fontSize: 16,
        // 字体颜色
        fontColor: "#ffffff",
        // 字体
        fontFamily: `sans-serif,"Source Han Sans SC","Source Han Sans","WenQuanYi Micro Hei", "Times New Roman", "隶书", "幼圆"`,
        // 加粗
        fontWeight: 400,
        // 字体风格（斜体）
        fontStyle: "normal",
        // 行间距
        lineGap: 0,
        // 内边距
        padding: 0,
        // 对齐方式, left, center, right
        align: "center",
        // 文本基线, top, middle, bottom,alphabetic,hanging,ideographic
        baseline: "top",
        // 描边宽度
        strokeWidth: 0,
        // 描边颜色
        strokeColor: "#FFFFFF",
        // 是否填充
        fill: false,
        // 填充颜色
        fillColor: "#000000",
    }
})

export default class Billboard extends THREE.Sprite<BillboardEventMap> {
    type = 'Billboard';
    isBillboard = true;

    options = getDefaultBillboardOptions();

    constructor(options: IBillboard.options, material?: THREE.SpriteMaterial) {
        super()

        deepAssign(this.options, options);

        this.name = this.options.name;

        const texture = new BillboardTexture(this.options, material ? (material.map?.image) : undefined);
        texture.colorSpace = THREE.SRGBColorSpace;

        if (material) {
            if (material.map) {
                texture.mapping = material.map.mapping;
                texture.wrapS = material.map.wrapS;
                texture.wrapT = material.map.wrapT;
                texture.magFilter = material.map.magFilter;
                texture.minFilter = material.map.minFilter;
                texture.anisotropy = material.map.anisotropy;
                texture.format = material.map.format;
                texture.type = material.map.type;
                texture.colorSpace = material.map.colorSpace;
                texture.repeat.copy(material.map.repeat);
                texture.offset.copy(material.map.offset);
                texture.center.copy(material.map.center);
                texture.matrix.copy(material.map.matrix);
            }

            this.material = material;
            this.material.map = texture;
        } else {
            this.material = new THREE.SpriteMaterial({
                map: texture,
                sizeAttenuation: true,
                depthWrite: true,
            });
        }

        // @ts-ignore
        texture.addEventListener("imgLoaded", (event) => {
            this.material.needsUpdate = true;

            // @ts-ignore
            this.dispatchEvent({ type: "imgLoaded", url: event.url })
        })
        // @ts-ignore
        texture.addEventListener("redraw", (event) => {
            const wh = {
                width: texture.width,
                height: texture.height,
            }
            if (wh.width > wh.height) {
                wh.width = wh.width / wh.height;
                wh.height = 1;
            } else {
                wh.height = wh.height / wh.width;
                wh.width = 1;
            }

            this.geometry = new THREE.PlaneGeometry(wh.width, wh.height);

            // @ts-ignore
            this.dispatchEvent({ type: "redraw", url: event.url })
        })

        this.position.set(this.options.position[0], this.options.position[1], this.options.position[2]);

        // this.center = new THREE.Vector2(0.5, 0);
    }

    /**
     * 获取json配置
     */
    toJSON(meta?: THREE.JSONMeta) {
        const options = JSON.parse(JSON.stringify(this.options));
        options.name = this.name;
        options.position = this.position.toArray();

        const superJSON = super.toJSON(meta);
        superJSON.object.options = options;

        return superJSON;
    }

    /**
     * 从json配置解析
     */
    static fromJSON(json: { material: THREE.SpriteMaterial, options: IBillboard.options }) {
        return new Billboard(json.options, json.material);
    }
}