import * as THREE from "three";
import {
    Timeline,
    TimelineRow,
    TimelineModel,
    TimelineOptions,
    TimelineKeyframe,
    TimelineInteractionMode,
    TimelineKeyframeChangedEvent, TimelineClickEvent
} from "#/core/libs/astral-timeline/animation-timeline";
import { useAddSignal, useDispatchSignal } from "#/hooks";
import { getParentPath, debounce, deepAssign, getNestedProperty } from "#/utils";
import { KeyframeTrackFactory } from "#/core/animation/AnimationManager";
import App from "#/core/app/App";

export interface ITimelineKeyframe extends TimelineKeyframe {
    data: number[] | boolean[]
}

export interface ITimelineRow extends TimelineRow {
    id: string;
    name: string;
    keyframes?: ITimelineKeyframe[];
    track?: THREE.KeyframeTrack;
}

export interface ITimelineModel extends TimelineModel {
    rows: ITimelineRow[]
}

// 定义事件类型
type CustomEvents = {
    'contextmenu': { args: TimelineClickEvent };
    'mousedown': { args: TimelineClickEvent };
};

let _aniamtionMixerUpdateFn;
class TimelineTrack extends THREE.EventDispatcher<CustomEvents> {
    container: HTMLDivElement;
    outlineContainer: HTMLDivElement;

    timeline: Timeline;
    model: ITimelineModel;
    options: TimelineOptions;

    /**
     * 动画编辑轨道当前正在处理的（绑定的）动画
     */
    bindAction: THREE.AnimationAction | null = null;

    private resizeObserver: ResizeObserver;

    constructor(container: HTMLDivElement, outlineContainer: HTMLDivElement, _options: TimelineOptions) {
        super();

        this.container = container;
        this.outlineContainer = outlineContainer;

        this.model = { rows: [] } as ITimelineModel;
        this.options = {
            id: container,
            headerHeight: 40,
            font: "0.7rem sans-serif",
            leftMargin: 22,
            headerFillColor: "#00000066",
            fillColor: "#333333",
            labelsColor: "#FFFFFFCC",
            tickColor: "#FFFFFF4C",
            // 选中矩形颜色
            selectionColor: "blue",
            zoom: 120,
            zoomMin: 30,
            zoomMax: 120,
            // 一步的长度，默认一步一个像素代表1000ms
            stepVal: 1000,
            rowsStyle: {
                height: 40,
                fillColor: "#252526",
                marginBottom: 2,
                // 关键帧样式
                keyframesStyle: {
                    fillColor: "#9A9A9A"
                },
                // 组的样式。关键帧组也可以单独设置样式。
                groupsStyle: {
                    text: {
                        label: "",
                        isStroke: false,
                        font: "1.5rem sans-serif",
                        textAlign: "center",
                        textBaseline: "top",
                        direction: "inherit",
                        fillColor: "#fff"
                    }
                }
            },
            // 时间轴指示器样式(竖线)
            timelineStyle: {
                marginTop: 0,
                fillColor: "#00ff00",
                strokeColor: "#00ff00",
                cursor: "e-resize",
                // 顶帽样式
                capStyle: {
                    width: 8,
                    height: 12,
                    fillColor: "#00ff00",
                    capType: "rect"
                }
            },
            // 关键帧组可拖动
            groupsDraggable: true,
            // 关键帧可拖动
            keyframesDraggable: true,
            // 用于确定要呈现的仪表“漂亮”数字的分母数组。
            denominators: [1, 6]
        } as TimelineOptions;
        deepAssign(this.options, _options);

        this.timeline = this.init();

        this.updateTrackLength();

        this.initEvent();

        this.resizeObserver = new ResizeObserver(this.resize.bind(this));
        this.resizeObserver.observe(container);
    }

    // 当前所有关键帧中的最大值,单位为ms
    get _maxDuration() {
        let max = 0;
        this.model.rows.forEach((row) => {
            if (!row.keyframes) return;

            row.keyframes.forEach((kf) => {
                if (kf.val > max) {
                    max = kf.val;
                }
            });
        });

        return max;
    }

    init() {
        // const dpr = window.devicePixelRatio || 1;
        // this.container.style.width = this.container.width / scale + 'px';
        // this.container.style.height = this.container.height / scale + 'px';
        const tl = new Timeline(this.options, this.model);
        // 可横向拖动
        tl.setInteractionMode(TimelineInteractionMode.Pan);
        //重写方法来更改显示的单位文本,显示为 00:00
        tl._formatUnitsText = (val) => {
            const v = Math.floor(val / 1000);
            const minutes = Math.floor(v / 60);
            const seconds = v - minutes * 60;
            return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        };

        if (window.devicePixelRatio !== 1) {
            tl._pixelRatio = window.devicePixelRatio;
            const scale = 1 / tl._pixelRatio;
            const translate = (1 - scale) * 100 / 2 * window.devicePixelRatio;
            if (tl._canvas) {
                tl._canvas.style.transform = `scale(${scale}) translate(-${translate}%, -${translate}%)`;
            }
        }

        return tl;
    }

    initEvent() {
        this.timeline.onScroll((args) => {
            //滚动同步
            if (this.outlineContainer) {
                this.outlineContainer.style.minHeight = args.scrollHeight + "px";

                if (this.outlineContainer.parentElement) {
                    this.outlineContainer.parentElement.scrollTop = args.scrollTop;
                }
            }
        });

        // this.timeline.onScrollFinished((args) => {});

        // 关键帧被改变时触发（防抖）
        const _keyframeChanged = debounce(this.onKeyframeChanged.bind(this), 100);
        this.timeline.onKeyframeChanged(_keyframeChanged);

        // this.timeline.onSelected((args) => {});

        this.timeline.onContextMenu(async (args) => {
            // 禁用默认右键菜单
            (args.args as MouseEvent).preventDefault();

            if (args.elements.length === 0) return;

            this.dispatchEvent({ type: "contextmenu", args: args });
        });

        this.timeline.onMouseDown((args) => {
            const e = args.args as MouseEvent;
            e.stopPropagation();

            if (e.button === 2) return;

            this.dispatchEvent({ type: "mousedown", args: args });
        });

        this.timeline.onTimeChanged((args) => {
            useDispatchSignal("timelineTimeChanged", args);

            if (!this.bindAction) return;

            this.bindAction.enabled = true;
            const _second = args.val / 1000;
            const duration = this.bindAction.getClip().duration;
            if (_second > duration) {
                this.bindAction.time = duration;
            } else {
                this.bindAction.time = _second;
            }

            // 如果动作没激活过则激活一次
            if (!this.bindAction.isScheduled()) {
                this.bindAction.play();
                this.bindAction.paused = true;
            }

            this.bindAction.getMixer().update(0.016);
            // this.bindAction.getRoot() 获取到的对象可能是editor.locked对象，需要获取正在操作的对象

            if (App.selected) {
                useDispatchSignal("objectChanged", App.selected);
                useDispatchSignal("materialChanged", App.selected.material);
            }
        });

        // this.timeline.onDrag((args) => {});

        _aniamtionMixerUpdateFn = this.handleMixerUpdate.bind(this);
        useAddSignal("animationMixerUpdate", _aniamtionMixerUpdateFn)
    }

    /**
     * 改变时间轴长度,可视区域默认一分钟
     */
    updateTrackLength() {
        this.options.stepVal = 60 * 1000 / (this.timeline._canvasClientWidth() - (this.options.leftMargin || 30));

        this.timeline.setOptions(this.options);
    }

    /**
     * 设置轨道行，this.model.rows 永远都只通过此方法变更
     */
    setRows(rows: Array<ITimelineRow>) {
        const newRows: Array<ITimelineRow> = [];
        rows.forEach((row) => {
            newRows.push(row);
        });

        this.model.rows = newRows;
        this.timeline.setModel(this.model);
    }

    /**
     * 设置节点是否可见
     * @param keys 节点id数组
     * @param visible 是否可见
     */
    setRowIsVisible(keys: string[], visible: boolean) {
        this.model.rows.forEach(row => {
            if (keys.includes(row.id)) {
                row.hidden = !visible;
            }
        })

        this.timeline.redraw();
    }

    /**
     * 动画混合器更新渲染
     * @param mixer d
     * @param delta
     */
    handleMixerUpdate(mixer: THREE.AnimationMixer, delta: number) {
        if (!this.bindAction || !mixer || !delta) return;

        if (!this.bindAction.isRunning()) return;

        if (this.bindAction.getMixer() !== mixer) return;

        const fromPx = this.timeline.scrollLeft;
        const toPx = this.timeline.scrollLeft + this.timeline.getClientWidth();

        const positionInPixels =
            this.timeline.valToPx(this.timeline.getTime()) + this.timeline._leftMargin();
        // 如果时间轴超出界限，则滚动至时间轴位置：
        if (positionInPixels <= fromPx || positionInPixels >= toPx) {
            this.timeline.scrollLeft = positionInPixels;
        }

        this.timeline.setTime(this.bindAction.time * 1000);
    }

    /**
     * 删除轨道行
     * @param row 轨道行
     */
    deleteRow(row: ITimelineRow) {
        const track = row.track;
        if (!this.bindAction || !track) return;

        const clip = this.bindAction.getClip();
        clip.tracks.splice(clip.tracks.indexOf(track), 1);
        // 更新剪辑时间
        clip.resetDuration();
        // 重新剪辑action
        this.bindAction = App.animationManager.reClipAction(this.bindAction, this.timeline.getTime() / 1000) as THREE.AnimationAction;

        this.model.rows.splice(this.model.rows.indexOf(row), 1);

        // 刷新
        this.timeline.redraw();
        this.bindAction.getMixer().update(0.016);
        useDispatchSignal("sceneGraphChanged");

        useDispatchSignal("timelineRowChanged", row, "remove");
    }

    /**
     * 添加关键帧
     * @param attr 动画属性名 ('position' | 'rotation' | 'quaternion' |'scale')
     */
    addKeyframe(attr: string) {
        if (!this.bindAction || !App.selected) return;

        // 当前时间轴时间（秒）
        const currentTime = this.timeline.getTime() / 1000;
        const currentClip = this.bindAction.getClip();
        // this.bindAction.getRoot() 获取到的对象可能是editor.locked对象，需要获取正在操作的对象
        let val = getNestedProperty(App.selected, attr);

        const insertValue = (valueTrack: number[] | boolean[], index: number, delLength: number = 0) => {
            let keyData: any[];

            switch (attr) {
                case "position":
                case "rotation":
                case "scale":
                    keyData = [val.x, val.y, val.z];
                    valueTrack.splice(index, delLength, ...keyData);
                    break;
                case "quaternion":
                    keyData = [val.x, val.y, val.z, val.w];
                    valueTrack.splice(index, delLength, ...keyData);
                    break;
                case "visible":
                case "fov":
                case "near":
                case "far":
                case "intensity":
                case "distance":
                case "renderOrder":
                case "material.shininess":
                case "material.reflectivity":
                case "material.roughness":
                case "material.metalness":
                case "material.clearcoat":
                case "material.clearcoatRoughness":
                case "material.iridescence":
                case "material.iridescenceIOR":
                case "material.sheen":
                case "material.sheenRoughness":
                case "material.transmission":
                case "material.attenuationDistance":
                case "material.thickness":
                case "material.size":
                case "material.opacity":
                case "material.alphaTest":
                // boolean
                case "material.vertexColors":
                case "material.sizeAttenuation":
                case "material.flatShading":
                case "material.transparent":
                case "material.depthTest":
                case "material.depthWrite":
                case "material.wireframe":
                    keyData = [val];
                    valueTrack.splice(index, delLength, ...keyData);
                    break;
                case "color":
                case "groundcolor":
                case "material.color":
                case "material.specular":
                case "material.emissive":
                case "material.sheenColor":
                case "material.attenuationColor":
                    if (!(val instanceof THREE.Color)) {
                        val = new THREE.Color(val);
                    }

                    keyData = [val.r, val.g, val.b];
                    valueTrack.splice(index, delLength, ...keyData);
                    break;
                default:
                    keyData = [val];
                    valueTrack.splice(index, delLength, ...keyData);
                    break;
            }

            return keyData;
        }

        // 获取当前添加关键帧的模型的属性轨道
        let track = App.animationManager.hasExistingTrack(currentClip, attr) as THREE.KeyframeTrack;
        // 如果不存在当前属性轨道，则新增轨道
        if (!track) {
            // 先获取锁定对象到选中对象路径
            let path = App.selected?.name;
            if (App.locked && App.selected && App.locked !== App.selected) {
                path = getParentPath(App.locked, App.selected);
            }

            let _times = [currentTime], _values: any[] = [];
            const keyData = insertValue(_values, 0);
            const _row: ITimelineRow = {
                id: `${path}.${attr}`,
                name: `${path}.${attr}`,
                keyframes: [
                    {
                        val: this.timeline.getTime(),
                        data: keyData,
                        selected: true
                    }
                ]
            }

            // 如果新建轨道默认关键帧不在0位则补0
            if (currentTime !== 0) {
                _times.unshift(0);
                _values.unshift(...keyData);
                _row.keyframes?.unshift({
                    val: 0,
                    data: keyData,
                    selected: true
                })
            }

            track = KeyframeTrackFactory(`${path}.${attr}`, _times, _values);
            // 新增轨道
            currentClip.tracks.push(track);

            _row.track = track;
            this.model.rows.push(_row)

            useDispatchSignal("timelineRowChanged", _row, "add");
        } else {
            const _times: number[] = Array.from(track.times);
            const _values: number[] = Array.from(track.values);
            const dataLength = Math.floor(_values.length / _times.length);

            const row = this.model.rows.find(row => row.track === track) as ITimelineRow;

            // 判断当前时间是否已存在关键帧
            let index = _times.findIndex(time => time === currentTime);
            let keyData;
            if (index !== -1) {
                // 更新当前时间的关键帧数据
                keyData = insertValue(_values, index, dataLength);

                // 动画轨道UI修改关键帧值
                if (row && row.keyframes) {
                    row.keyframes.splice(index, 1, {
                        val: this.timeline.getTime(),
                        data: keyData,
                        selected: true
                    });
                }
            } else {
                // 获取关键帧数据插入位置
                index = _times.length;
                for (let i = 0; i < _times.length; i++) {
                    if (_times[i] > currentTime) {
                        index = i;
                        break;
                    }
                }
                // 插入关键帧时间
                _times.splice(index, 0, currentTime);
                // 插入关键帧数据
                keyData = insertValue(_values, index * dataLength);

                // 动画轨道UI添加关键帧
                if (row && row.keyframes) {
                    row.keyframes.splice(index, 0, {
                        val: this.timeline.getTime(),
                        data: keyData,
                        selected: true
                    });
                }
            }

            // 创建新的关键帧轨道替换
            const newTrack = KeyframeTrackFactory(track.name, _times, _values, track.getInterpolation());
            currentClip.tracks.splice(currentClip.tracks.indexOf(track), 1, newTrack);

            row.track = newTrack;
        }

        // 更新剪辑时间
        currentClip.resetDuration();
        // 重新剪辑action
        this.bindAction = App.animationManager.reClipAction(this.bindAction, currentTime) as THREE.AnimationAction;

        // 刷新
        this.timeline.redraw();
        this.bindAction.getMixer().update(0.016);
        useDispatchSignal("sceneGraphChanged");
    }

    /**
     * 关键帧被改变时触发（关键帧被拖动）
     */
    onKeyframeChanged(args: TimelineKeyframeChangedEvent) {
        const row = args.target?.row as ITimelineRow;
        const track = row.track;
        if (!this.bindAction || !track || !row.keyframes?.length) return;

        const clip = this.bindAction.getClip();

        // 确保完整，直接重建轨道
        const _times: number[] = [], _values: any = [];
        row.keyframes.forEach((kf) => {
            _times.push(kf.val / 1000);
            _values.push(...kf.data);
        })

        // 创建新的关键帧轨道替换
        const newTrack = KeyframeTrackFactory(track.name, _times, _values, track.getInterpolation());
        clip.tracks.splice(clip.tracks.indexOf(track), 1, newTrack);

        row.track = newTrack;

        // 更新剪辑时间
        clip.resetDuration();
        // 重新剪辑action
        this.bindAction = App.animationManager.reClipAction(this.bindAction, this.timeline.getTime() / 1000) as THREE.AnimationAction;

        // 刷新
        this.timeline.redraw();
        this.bindAction.getMixer().update(0.016);
        useDispatchSignal("sceneGraphChanged");
    }

    /**
     * 删除选中的关键帧
     */
    deleteSelectedKeyframes() {
        if (!this.bindAction) return;
        const selectedRows = this.model.rows.filter(row => row.keyframes?.some(kf => kf.selected));

        selectedRows.forEach(row => {
            if (!row.keyframes) return;

            // 先删除关键帧
            row.keyframes = row.keyframes.filter(kf => !kf.selected);

            // 如果关键帧为空，则删除轨道
            if (row.keyframes.length === 0) {
                this.deleteRow(row);
                return;
            }

            // @ts-ignore
            this.onKeyframeChanged({ target: { row: row } });
        });
    }

    resize() {
        if (!this.timeline) return;

        this.timeline._handleWindowResizeEvent();
    }

    /**
     * 播放action
     */
    play() {
        if (!this.bindAction) return;

        // 不允许在播放过程中操纵时间轴(可选)。
        this.timeline.setOptions({
            timelineDraggable: false,
            groupsDraggable: false,
            keyframesDraggable: false,
            zoom: this.timeline._currentZoom
        });

        this.bindAction.play();
        this.bindAction.paused = false;
    }

    /**
     * 暂停/继续播放action
     */
    pause() {
        if (!this.bindAction) return;

        if (this.bindAction.paused) {
            this.bindAction.paused = false;

            this.timeline.setOptions({
                timelineDraggable: false,
                groupsDraggable: false,
                keyframesDraggable: false,
                zoom: this.timeline._currentZoom
            });
        } else {
            this.bindAction.paused = true;

            this.timeline.setOptions({
                timelineDraggable: true,
                groupsDraggable: true,
                keyframesDraggable: true,
                zoom: this.timeline._currentZoom
            });
        }
    }

    /**
     * 停止播放action
     */
    stop() {
        if (!this.bindAction) return;

        this.timeline.setOptions({
            timelineDraggable: true,
            groupsDraggable: true,
            keyframesDraggable: true,
            zoom: this.timeline._currentZoom
        });

        this.timeline.scrollLeft = 0;
        this.timeline.setTime(0);

        this.bindAction.stop();
    }

    /**
     * 更新配置
     */
    setOptions(_options: TimelineOptions) {
        deepAssign(this.options, _options);
        this.timeline.setOptions(this.options);
    }

    dispose() {
        this.resizeObserver.disconnect();

        this.timeline?.dispose();
    }
}

export { TimelineTrack }