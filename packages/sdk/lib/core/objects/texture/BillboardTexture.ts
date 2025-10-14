/**
 * @author ErSan
 * @email  mlt131220@163.com
 * @date   2025/4/6 13:07
 * @description 广告牌map
 */
import * as THREE from 'three';
import log from "#/utils/log/Logger";
import { POSITION } from "#//constant";

export default class BillboardTexture extends THREE.CanvasTexture {
    private options: IBillboard.options;
    private _img: HTMLImageElement | null = null;
    private isImgLoading: boolean = false;

    constructor(options: IBillboard.options, image?: HTMLImageElement) {
        super(
            document.createElement('canvas'), // image
            THREE.Texture.DEFAULT_MAPPING, // mapping
            THREE.RepeatWrapping, // wrapS
            THREE.RepeatWrapping, // wrapT
            THREE.LinearFilter, // magFilter
            THREE.LinearMipmapLinearFilter, // minFilter
            THREE.RGBAFormat, // format
            THREE.UnsignedByteType, // type
            THREE.Texture.DEFAULT_ANISOTROPY // anisotropy
        )

        this.options = options;
        if (this.options.image) {
            this.options.image = new Proxy(this.options.image, {
                set: (target, key, value) => {
                    target[key] = value;

                    if (key === "url" && value) {
                        this.loadImg();
                    } else {
                        this.redraw();
                    }

                    return true;
                }
            })
        }
        if (this.options.text) {
            this.options.text = new Proxy(this.options.text, {
                set: (target, key, value) => {
                    target[key] = value;

                    this.redraw();

                    return true;
                }
            })
        }

        this.redraw();

        this.loadImg(image);
    }

    get lines() {
        if (!this.options.text.visible || !this.options.text.value) return [];

        return String(this.options.text.value).split(/\r?\n/);
    }

    get font() {
        return `${this.options.text?.fontStyle || 'normal'} normal ${this.options.text?.fontWeight || 'normal'} ${this.options.text?.fontSize || 16}px ${this.options.text?.fontFamily || 'sans-serif'}`;
    }

    get textWidth() {
        if (this.options.text.visible && this.lines.length) {
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d') as CanvasRenderingContext2D;
            context.font = this.font;
            return Math.max(...this.lines.map(text => context.measureText(text).width));
        }

        return 0;
    }

    get textHeight() {
        if (this.options.text.visible && this.lines.length) {
            return this.lines.length * (this.options.text.fontSize || 16) + (this.options.text.lineGap || 0) * (this.lines.length - 1);
        }
        return 0;
    }

    get imageSize() {
        return {
            width: this.options.image.width || 0,
            height: this.options.image.height || 0,
        }
    }

    get width() {
        const padding = this.options.text.padding || 0;
        const imageMargin = this.options.image.margin || 0;

        const imageSize = this.imageSize;

        if (!this.options.text.value || !this.options.text.visible) return imageSize.width;

        if (!this.options.image.url || !this.options.image.visible) return this.textWidth + padding * 2;

        let width = padding * 2;
        switch (this.options.image.position?.toLowerCase()) {
            case POSITION.LEFT:
            case POSITION.TOP_LEFT:
            case POSITION.TOP_RIGHT:
            case POSITION.BOTTOM_LEFT:
            case POSITION.BOTTOM_RIGHT:
            case POSITION.RIGHT:
                width += this.textWidth + this.imageSize.width + imageMargin;
                break;
            case POSITION.BOTTOM:
            case POSITION.TOP:
                width += Math.max(this.textWidth, this.imageSize.width);
                break;
            default:
                width += Math.max(this.textWidth, this.imageSize.width) + imageMargin;
                break;
        }

        return width;
    }

    get height() {
        const padding = this.options.text.padding || 0;
        const imageMargin = this.options.image.margin || 0;

        const imageSize = this.imageSize;

        if (!this.options.text.value || !this.options.text.visible) return imageSize.height;

        if (!this.options.image.url || !this.options.image.visible) return padding * 2 + this.textHeight;

        let height = padding * 2;

        switch (this.options.image.position?.toLowerCase()) {
            case POSITION.TOP:
            case POSITION.BOTTOM:
                height += this.textHeight + imageSize.height + imageMargin;
                break;
            default:
                height += Math.max(this.textHeight, imageSize.height);
                break;
        }
        return height;
    }

    async loadImg(image?: HTMLImageElement) {
        if (this.isImgLoading) return;

        if (image) {
            this._img = image;
            this.redraw();

            // @ts-ignore
            this.dispatchEvent({ type: "imgLoaded", url: this.options.image?.url })

            this.isImgLoading = false;

            return;
        }

        if (this.options.image?.url) {
            const img = new Image();
            // 设置跨域模式（解决 CORS 问题）
            img.crossOrigin = "anonymous";

            this.isImgLoading = true;
            img.onload = () => {
                this._img = img;
                this.redraw();

                // @ts-ignore
                this.dispatchEvent({ type: "imgLoaded", url: this.options.image?.url })

                this.isImgLoading = false;

                // // 生成Canvas的DataURL
                // const dataUrl = this.image.toDataURL('image/png'); // 可选参数：'image/jpeg'，并可设置质量
                //
                // // 创建下载链接
                // const link = document.createElement('a');
                // link.href = dataUrl;
                // link.download = 'canvas-image.png'; // 设置下载的文件名
                //
                // // 触发下载
                // document.body.appendChild(link);
                // link.click();
                //
                // // 可选：移除链接
                // document.body.removeChild(link);
            }
            // @ts-ignore
            img.onerror = (e: Error) => {
                console.log(`[BillboardTexture] 图片载入失败：`, e)
                log.error(`[BillboardTexture] 图片载入失败：${e.toString()}`);

                this.isImgLoading = false;
            }

            img.src = this.options.image.url;
        }
    }

    redraw() {
        if (!this.image) return;

        // 默认均按512x512绘制，再按比例缩放,以保持清晰
        const canvasWidth = 512;
        const canvasHeight = 512;

        if (this.width && this.height) {
            this.image.width = canvasWidth;
            this.image.height = canvasHeight;

            const imageSize = this.imageSize;
            let imageWidth = imageSize.width;
            let imageHeight = imageSize.height;

            let context = this.image.getContext('2d');
            context.clearRect(0, 0, this.image.width, this.image.height);
            context.scale(canvasWidth / this.width, canvasHeight / this.height);
            context.save();

            const imageIsVisible = this.options.image.url && this.options.image.visible;
            let imageMargin = imageIsVisible ? (this.options.image.margin || 0) : 0;
            imageWidth = imageIsVisible ? imageWidth : 0;
            imageHeight = imageIsVisible ? imageHeight : 0;

            let textIsVisible = this.options.text.value && this.options.text.visible;
            imageMargin = textIsVisible ? imageMargin : 0;

            const padding = this.options.text.padding || 0;
            const textAlign = this.options.text.align?.toLowerCase() || 'left';
            const imagePosition = this.options.image.position?.toLowerCase();
            // 图像位置
            let imageLeft = 0, imageTop = 0, left = 0, top = 0;

            // 绘制图片
            const drawImage = () => {
                if (imageIsVisible) {
                    if (textIsVisible) {
                        if (imagePosition === POSITION.LEFT) {
                            imageTop = this.height / 2 - imageHeight / 2;
                            imageLeft = 0;
                        }
                        if (imagePosition === POSITION.RIGHT) {
                            imageLeft = this.textWidth + padding * 2 + imageMargin;
                            imageTop = this.height / 2 - imageHeight / 2;
                        }
                        if (imagePosition === POSITION.TOP) {
                            imageLeft = this.width / 2 - imageWidth / 2;
                            imageTop = 0;
                        }
                        if (imagePosition === POSITION.BOTTOM) {
                            imageLeft = this.width / 2 - imageWidth / 2;
                            imageTop = this.textHeight + padding * 2 + imageMargin;
                        }
                        if (imagePosition == POSITION.CENTER) {
                            imageLeft = this.width / 2 - imageWidth / 2;
                            imageTop = this.height / 2 - imageHeight / 2;
                        }
                    }

                    if (!this._img) {
                        this.loadImg();
                    } else {
                        const rotate = this.options.image.rotate;
                        if (rotate) {
                            context.translate(imageLeft + imageWidth / 2, imageTop + imageHeight / 2);
                            context.rotate(rotate);
                            context.drawImage(this._img, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
                            context.rotate(-1 * rotate);
                            context.translate(-imageLeft - imageWidth / 2, -imageTop - imageHeight / 2)
                        } else {
                            context.drawImage(this._img, imageLeft, imageTop, imageWidth, imageHeight);
                        }
                    }
                }
            }

            const drawText = () => {
                // 绘制文字
                if (textIsVisible) {
                    const rect = {
                        left: left,
                        top: top,
                        width: this.textWidth + padding * 2,
                        height: this.textHeight + padding * 2,
                    }

                    if (imageIsVisible) {
                        if (imagePosition === POSITION.LEFT) {
                            rect.left = imageWidth + imageMargin;
                            rect.top = this.height / 2 - rect.height / 2;
                        }
                        if (imagePosition === POSITION.RIGHT) {
                            rect.left = 0;
                            rect.top = this.height / 2 - rect.height / 2;
                        }
                        if (imagePosition === POSITION.TOP) {
                            rect.left = 0;
                            rect.top = imageHeight + imageMargin;
                        }
                        if (imagePosition === POSITION.BOTTOM) {
                            rect.left = 0;
                            rect.top = 0;
                        }
                        if (imagePosition == POSITION.CENTER) {
                            rect.left = 0;
                            rect.top = 0;
                            rect.width = this.width;
                            rect.height = this.height;
                        }
                    }

                    switch (textAlign) {
                        // 文字左对齐
                        case 'left':
                            left = padding;
                            top = padding;
                            if (imageIsVisible) {
                                switch (imagePosition) {
                                    case POSITION.TOP:
                                        top += imageMargin + imageHeight;
                                        break;
                                    case POSITION.LEFT:
                                        left += imageMargin + imageWidth;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.CENTER:
                                        left = this.width / 2 - this.textWidth / 2 - padding;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.BOTTOM:
                                        break;
                                    case POSITION.RIGHT:
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                }
                            }
                            break;
                        // 文字右对齐
                        case 'right':
                            left = this.width - padding;
                            top = padding;

                            if (imageIsVisible) {
                                switch (imagePosition) {
                                    case POSITION.TOP:
                                        top += imageMargin + imageHeight;
                                        break;
                                    case POSITION.LEFT:
                                        left = this.width - padding;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.CENTER:
                                        left = this.width - padding;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.BOTTOM:
                                        break;
                                    case POSITION.RIGHT:
                                        left = this.width - imageWidth - imageMargin - padding;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                }
                            }
                            if (this.lines.length == 1) {
                                top += 2;
                            }
                            break;
                        // 文字居中
                        case 'center':
                            top = padding;
                            left = this.width / 2 + imageMargin;
                            if (imageIsVisible) {
                                switch (imagePosition) {
                                    case POSITION.TOP:
                                        top += imageMargin + imageHeight;
                                        left = this.width / 2;
                                        break;
                                    case POSITION.LEFT:
                                        left = this.width / 2 + imageWidth / 2 + imageMargin / 2;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.CENTER:
                                        left = this.width / 2;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                    case POSITION.BOTTOM:
                                        left = this.width / 2;
                                        break;
                                    case POSITION.RIGHT:
                                        left = this.width / 2 - imageWidth / 2 - imageMargin / 2;
                                        top = this.height / 2 - this.textHeight / 2;
                                        break;
                                }
                            }
                            break;
                    }

                    // 填充背景
                    if (this.options.text.fill && this.options.text.fillColor) {
                        context.save();
                        context.fillStyle = this.options.text.fillColor;
                        context.fillRect(rect.left, rect.top, rect.width, rect.height);
                        context.restore();
                    }

                    context.textAlign = textAlign;
                    context.font = this.font;
                    context.textBaseline = this.options.text.baseline || 'top';
                    context.fillStyle = this.options.text.fontColor || '#ffffff';
                    context.lineJoin = 'miter';
                    context.miterLimit = 1;
                    context.lineWidth = this.options.text.strokeWidth;
                    context.strokeStyle = this.options.text.strokeColor;
                    this.lines.forEach(t => {
                        if (this.options.text.strokeWidth) {
                            context.strokeText(t, left, top);
                        }
                        context.fillText(t, left, top);
                        top += (this.options.text.fontSize || 16) + (this.options.text.lineGap || 0);
                    });
                }
            }


            if (this.options.image.top) {
                drawText();
                drawImage();
            } else {
                drawImage();
                drawText();
            }

            context.restore();
        } else {
            this.image.width = this.image.height = 1;
            log.warn("[BillboardTexture] 宽高为0，无法绘制");
        }

        this.needsUpdate = true;

        // @ts-ignore
        this.dispatchEvent({ type: "redraw" })
    }
}