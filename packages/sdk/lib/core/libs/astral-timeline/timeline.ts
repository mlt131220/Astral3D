/* eslint-disable @typescript-eslint/no-explicit-any */
// bundle entry point

import { TimelineEventsEmitter } from './timelineEventsEmitter';
import { TimelineConsts } from './settings/timelineConsts';

// @public timeline models
import { TimelineRanged } from './models/timelineRanged';
import { TimelineModel } from './models/timelineModel';
import { TimelineRow } from './models/timelineRow';
import { TimelineKeyframe } from './models/timelineKeyframe';
// @public styles
import { TimelineOptions } from './settings/timelineOptions';

import { TimelineStyleUtils } from './utils/timelineStyleUtils';
import { TimelineUtils } from './utils/timelineUtils';
import { TimelineElement } from './utils/timelineElement';

// @private helper containers.
import { TimelineCutBoundsRectResults } from './utils/timelineCutBoundsRectResults';
import { TimelineSelectionResults } from './utils/timelineSelectionResults';
import { TimelineMouseData } from './utils/timelineMouseData';
import { TimelineElementDragState } from './utils/timelineElementDragState';
import { TimelineDraggableData } from './utils/timelineDraggableData';

// @private virtual model
import { TimelineGroupViewModel } from './viewModels/timelineGroupViewModel';
import { TimelineKeyframeViewModel } from './viewModels/timelineKeyframeViewModel';
import { TimelineRowViewModel } from './viewModels/timelineRowViewModel';
import { TimelineViewModel } from './viewModels/timelineViewModel';

// @public events
import { TimelineKeyframeChangedEvent } from './utils/events/timelineKeyframeChangedEvent';
import { TimelineTimeChangedEvent } from './utils/events/timelineTimeChangedEvent';
import { TimelineSelectedEvent } from './utils/events/timelineSelectedEvent';
import { TimelineScrollEvent } from './utils/events/timelineScrollEvent';
import { TimelineClickEvent } from './utils/events/timelineClickEvent';
import { TimelineDragEvent } from './utils/events/timelineDragEvent';

// @public enums
import { TimelineKeyframeShape } from './enums/timelineKeyframeShape';
import { TimelineInteractionMode } from './enums/timelineInteractionMode';
import { TimelineElementType } from './enums/timelineElementType';
import { TimelineCursorType } from './enums/timelineCursorType';
import { TimelineCapShape } from './enums/timelineCapShape';
import { TimelineEventSource } from './enums/timelineEventSource';
import { TimelineSelectionMode } from './enums/timelineSelectionMode';
import { TimelineEvents } from './enums/timelineEvents';
// @private defaults are exposed:

import { TimelineScrollSource } from './enums/timelineScrollSource';
import { defaultTimelineConsts } from './settings/defaults/defaultTimelineConsts';
import { defaultTimelineOptions } from './settings/defaults/defaultTimelineOptions';
import { remToPxNumber } from "#/utils";

export class Timeline extends TimelineEventsEmitter {
    /**
     * component container.
     */
    _container: HTMLElement | null = null;
    /**
     * Dynamically generated canvas inside of the container.
     */
    _canvas: HTMLCanvasElement | null = null;
    /**
     * Dynamically generated scroll container.
     */
    _scrollContainer: HTMLElement | null = null;
    /**
     * Dynamically generated virtual scroll content.
     * While canvas has no real size, this element is used to create virtual scroll on the parent element.
     */
    _scrollContent: HTMLElement | null = null;
    /**
     * Rendering context
     */
    _ctx: CanvasRenderingContext2D | null = null;
    /**
     * Components settings
     */
    _options!: TimelineOptions;
    /**
     * Drag start position.
     */
    _startPosMouseArgs: TimelineMouseData | null = null;
    /**
     * Drag scroll started position.
     */
    _scrollStartPos: DOMPoint | null = null;
    /**
     * Private. Current mouse position that is used to track values between mouse up/down events.
     * Can be null, use public methods and properties instead.
     */
    _currentPos: TimelineMouseData | null = null;

    /**
     * Private. Current active mouse area selection rectangle displayed during the mouse up/down drag events.
     */
    _selectionRect: DOMRect | null = null;
    /**
     * Private. Whether selection rectangle is displayed.
     */
    _selectionRectEnabled = false;
    /**
     * Private. Information in regard of current active drag state.
     */
    _drag: TimelineDraggableData | null = null;
    _startedDragWithCtrl = false;
    _startedDragWithShiftKey = false;
    _scrollProgrammatically = false;
    _clickTimeout: number | null = null;
    _lastClickTime = 0;
    _lastClickPoint: DOMPoint | null = null;
    _consts: TimelineConsts = defaultTimelineConsts;
    /**
     * Private. whether click is allowed.
     */
    _clickAllowed = false;
    /**
     * Private. scroll finished timer reference.
     */
    _scrollFinishedTimerRef?: number | null = null;
    /**
     * Private.Current timeline position.
     * Please use public get\set methods to properly change the timeline position.
     */
    _val = 0;
    _pixelRatio = 1;
    /**
     * Private. Current zoom level. Please use publicly available properties to set zoom levels.
     */
    _currentZoom = 0;
    /**
     * Private. Ref for the auto pan scroll interval.
     */
    _intervalRef?: number | null = null;
    /**
     * Private.
     * When last auto pan scroll action was started.
     */
    _autoPanLastActionDate = 0;
    /**
     * Private.
     * Is pan mouse interactions are started.
     */
    _isPanStarted = false;
    /**
     * Private.
     * Component interaction mode. Please use publicly available methods.
     */
    _interactionMode = TimelineInteractionMode.Selection;

    _lastUsedArgs: MouseEvent | TouchEvent | null = null;
    /**
     * Private.
     * Current set timeline model.
     */
    _model: TimelineModel | null = null;
    /**
     * Private.
     * Indication when scroll are drag or click is started.
     */
    _scrollAreaClickOrDragStarted = false;
    /**
     * Create Timeline instance
     * @param options Timeline settings.
     * @param model Timeline model.
     */
    constructor(options: TimelineOptions | null = null, model: TimelineModel | null = null) {
        super();
        this._options = TimelineUtils.cloneOptions(defaultTimelineOptions);
        // Allow to create instance without an error to perform tests.
        if (options || model) {
            this.initialize(options, model);
        }
    }

    /**
     * Initialize Timeline
     * @param options Timeline settings.
     * @param model Timeline model.
     */
    public initialize = (options: TimelineOptions | null, model: TimelineModel | null): void => {
        this._model = model;
        if (!options || !options.id) {
            throw new Error(`Element cannot be empty. Should be string or DOM element.`);
        }

        this._generateContainers(options.id);
        this._options = TimelineUtils.cloneOptions(defaultTimelineOptions);
        if (options) {
            this._options = this._setOptions(options);
        }
        this._subscribeComponentEvents();
        this.rescale();
        this.redraw();
    };

    /**
     * Generate component html.
     * @param id container.
     */
    _generateContainers = (id: string | HTMLElement): void => {
        if (id instanceof HTMLElement) {
            this._container = id as HTMLElement;
        } else {
            this._container = document.getElementById(id);
        }

        if (!this._container) {
            throw new Error(`Element cannot be empty. Should be string or DOM element.`);
        }

        this._scrollContainer = document.createElement('div');
        this._scrollContent = document.createElement('div');
        this._canvas = document.createElement('canvas');

        if (!this._canvas || !this._canvas.getContext) {
            console.log('Cannot initialize canvas context.');
            return;
        }
        this._container.innerHTML = '';
        this._container.style.position = 'relative';
        // Generate size container:
        this._canvas.style.cssText =
            'image-rendering: -moz-crisp-edges;' +
            'image-rendering: -webkit-crisp-edges;' +
            'image-rendering: pixelated;' +
            'image-rendering: crisp-edges;' +
            'user-select: none;' +
            '-webkit-user-select: none;' +
            '-khtml-user-select: none;' +
            '-moz-user-select: none;' +
            '-o-user-select: none;' +
            'user-select: none;' +
            'touch-action: none;' +
            'position: relative;' +
            '-webkit-user-drag: none;' +
            '-khtml-user-drag: none;' +
            '-moz-user-drag: none;' +
            '-o-user-drag: none;' +
            'user-drag: none;' +
            'padding: inherit';

        // Those styles are hardcoded and required for the proper scrolling.
        this._scrollContainer.style.cssText = 'overflow: scroll;' + 'position: absolute;' + 'width:  100%;' + 'height:  100%;';
        this._scrollContent.style.width = this._scrollContent.style.height = '100%';

        // add the text node to the created div
        this._scrollContainer.appendChild(this._scrollContent);
        this._container.appendChild(this._scrollContainer);
        const scrollBarWidth = this._scrollContainer.offsetWidth - this._scrollContent.clientWidth;
        // Calculate current browser scrollbar size and add offset for the canvas
        this._canvas.style.width = this._canvas.style.height = 'calc(100% -' + (scrollBarWidth || 17) + 'px)';

        this._container.appendChild(this._canvas);
        this._ctx = this._getCtx();
    };
    /**
     * Get drawing context
     */
    _getCtx(): CanvasRenderingContext2D | null {
        if (!this._canvas) {
            return null;
        }
        if (this._ctx) {
            return this._ctx;
        }
        this._ctx = this._canvas.getContext('2d');
        return this._ctx;
    }
    /**
     * Subscribe current component on the related events.
     * Private. Use initialize method instead.
     */
    _subscribeComponentEvents = (): void => {
        // Allow to call event multiple times, revoke current subscription and subscribe again.
        this._unsubscribeComponentEvents();
        if (!this._container || !this._scrollContainer || !this._canvas) {
            throw Error(`Cannot subscribe on scroll events while one of the containers is null or empty. Please call initialize method first`);
        }
        if (this._container) {
            this._container.addEventListener('wheel', this._handleWheelEvent);
        }
        if (this._scrollContainer) {
            this._scrollContainer.addEventListener('scroll', this._handleScrollEvent);
            this._scrollContainer.addEventListener('touchstart', this._handleScrollMouseDownEvent);
            this._scrollContainer.addEventListener('mousedown', this._handleScrollMouseDownEvent);
        }
        document.addEventListener('keyup', this._handleKeyUp, false);
        document.addEventListener('keydown', this._handleKeyDown, false);
        window.addEventListener('blur', this._handleBlurEvent, false);
        window.addEventListener('resize', this._handleWindowResizeEvent, false);
        if (this._canvas) {
            this._canvas.addEventListener('touchstart', this._handleMouseDownEvent, false);
            this._canvas.addEventListener('mousedown', this._handleMouseDownEvent, false);
            this._canvas.addEventListener('contextmenu', this._handleContextMenu, false);
        }
        window.addEventListener('mousemove', this._handleMouseMoveEvent, false);
        window.addEventListener('touchmove', this._handleMouseMoveEvent, false);
        window.addEventListener('mouseup', this._handleMouseUpEvent, false);
        window.addEventListener('touchend', this._handleMouseUpEvent, false);
    };

    /**
     * Private. Use dispose method instead.
     */
    _unsubscribeComponentEvents = (): void => {
        this._container?.removeEventListener('wheel', this._handleWheelEvent);

        if (this._scrollContainer) {
            this._scrollContainer.removeEventListener('scroll', this._handleScrollEvent);
            this._scrollContainer.removeEventListener('touchstart', this._handleScrollMouseDownEvent);
            this._scrollContainer.removeEventListener('mousedown', this._handleScrollMouseDownEvent);
        } else {
            console.warn(`Cannot unsubscribe scroll while it's already empty`);
        }
        window.removeEventListener('blur', this._handleBlurEvent);
        window.removeEventListener('resize', this._handleWindowResizeEvent);
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('keyup', this._handleKeyUp);
        if (this._canvas) {
            this._canvas.removeEventListener('touchstart', this._handleMouseDownEvent);
            this._canvas.removeEventListener('mousedown', this._handleMouseDownEvent);
            this._canvas.removeEventListener('contextmenu', this._handleContextMenu);
        } else {
            console.warn(`Cannot unsubscribe canvas while it's already empty`);
        }
        window.removeEventListener('mousemove', this._handleMouseMoveEvent);
        window.removeEventListener('touchmove', this._handleMouseMoveEvent);
        window.removeEventListener('mouseup', this._handleMouseUpEvent);
        window.removeEventListener('touchend', this._handleMouseUpEvent);
    };
    /**
     * Dispose current component: unsubscribe component and user events.
     */
    public dispose = (): void => {
        // Unsubscribe all user events.
        this.offAll();
        // Stop times
        this._stopAutoPan();
        this._clearScrollFinishedTimer();
        this._unsubscribeComponentEvents();
        if (this._container) {
            this._container.innerHTML = '';
        }
        this._container = null;
        this._canvas = null;
        this._scrollContainer = null;
        this._scrollContent = null;
        this._ctx = null;
        this._cleanUpSelection();
    };
    /**
     * On key up is received.
     */
    _handleKeyUp = (event: KeyboardEvent): void => {
        if (this._interactionMode === TimelineInteractionMode.Zoom) {
            this._setZoomCursor(event);
        }
    };
    /**
     * On key down is received.
     */
    _handleKeyDown = (event: KeyboardEvent): void => {
        if (this._interactionMode === TimelineInteractionMode.Zoom) {
            this._setZoomCursor(event);
        }
    };
    _setZoomCursor = (e: MouseEvent | KeyboardEvent): void => {
        if (this._controlKeyPressed(e)) {
            this._setCursor(TimelineCursorType.ZoomOut);
        } else {
            this._setCursor(TimelineCursorType.ZoomIn);
        }
    };
    _handleBlurEvent = (): void => {
        this._cleanUpSelection(true);
    };
    _handleWindowResizeEvent = (): void => {
        // Rescale and redraw
        this.rescale();
        this.redraw();
    };

    _clearScrollFinishedTimer = (): void => {
        if (this._scrollFinishedTimerRef) {
            clearTimeout(this._scrollFinishedTimerRef);
            this._scrollFinishedTimerRef = null;
        }
    };
    _handleScrollMouseDownEvent = (): void => {
        this._scrollAreaClickOrDragStarted = true;
    };
    _handleScrollEvent = (args: Event): void => {
        const scrollProgrammatically = this._scrollProgrammatically;
        if (this._scrollProgrammatically) {
            this._scrollProgrammatically = false;
        }
        // Stop previous running timeout.
        this._clearScrollFinishedTimer();
        // Set a timeout to run event 'scrolling end'.
        // Auto scroll is used to repeat scroll when drag element or select items outside of the visible area.
        this._scrollFinishedTimerRef = window.setTimeout(() => {
            if (!this._isPanStarted) {
                this._clearScrollFinishedTimer();

                this.rescale();
                this.redraw();
            }
            this._emitScrollEvent(args, scrollProgrammatically, TimelineEvents.ScrollFinished);
        }, this._consts.scrollFinishedTimeoutMs);

        this.redraw();
        this._emitScrollEvent(args, scrollProgrammatically);
    };
    _controlKeyPressed = (e: MouseEvent | KeyboardEvent | TouchEvent): boolean => {
        if (!this._options || this._options.controlKeyIsMetaKey === undefined) {
            return e.metaKey || e.ctrlKey;
        }
        return this._options.controlKeyIsMetaKey || this._options.controlKeyIsMetaKey ? e.metaKey : e.ctrlKey;
    };
    _handleWheelEvent = (event: WheelEvent): void => {
        if (!this._scrollContainer || !this._canvas) {
            // Component is not initialized yet.
            return;
        }
        if (this._controlKeyPressed(event)) {
            event.preventDefault();
            const mousePosArguments = this._getMousePos(this._canvas, event);
            const mousePos = Math.max(0, mousePosArguments.pos.x || 0);
            this._zoom(TimelineUtils.sign(event.deltaY), this._options.zoomSpeed || 0, mousePos);
        } else {
            this.scrollTop = this._scrollContainer.scrollTop + event.deltaY;
            event.preventDefault();
        }
    };
    _zoom = (direction: number, speed: number, x: number): void => {
        if (speed && speed > 0 && speed <= 1) {
            const deltaSpeed = TimelineUtils.getDistance(this._canvasClientWidth() / 2, x) * 0.2;
            x = x + deltaSpeed;
            const diff = this._canvasClientWidth() / x;
            const val = this._fromScreen(x);
            const zoom = direction * this._currentZoom * speed;
            //this._options.zoom
            this._currentZoom = this._setZoom(this._currentZoom + zoom);
            // Get only after zoom is set
            const zoomCenter = this.valToPx(val);
            let newScrollLeft = Math.round(zoomCenter - this._canvasClientWidth() / diff);
            if (newScrollLeft <= 0) {
                newScrollLeft = 0;
            }

            this._rescaleInternal(newScrollLeft + this._canvasClientWidth(), null, TimelineScrollSource.ZoomMode);
            this.scrollLeft = newScrollLeft;

            this.emit(TimelineEvents.Zoom, {
                zoom: this._currentZoom,
                zoomCenter: zoomCenter
            });

            this.redraw();
        }
    };
    /**
     * Zoom in
     * @param speed value from 0 to 1
     */
    public zoomIn = (speed = this._options.zoomSpeed): void => {
        const width = this._scrollContainer?.clientWidth || 0;
        if (speed && width) {
            this._zoom(1, speed, width / 2);
        }
    };
    /**
     * Zoom out.
     * @param speed value from 0 to 1
     */
    public zoomOut = (speed = this._options.zoomSpeed): void => {
        const width = this._scrollContainer?.clientWidth || 0;
        if (speed && width) {
            this._zoom(-1, speed, width / 2);
        }
    };
    /**
     * Set direct zoom value.
     * @param zoom zoom value to set. percent 0-1 and etc.
     * @param min min zoom.
     * @param max max zoom.
     * @return normalized value.
     */
    _setZoom = (zoom: number, min: number | null | undefined = null, max: number | null | undefined = null): number => {
        min = TimelineUtils.isNumber(min) ? min : this._options?.zoomMin;
        max = TimelineUtils.isNumber(max) ? max : this._options?.zoomMax;
        if (TimelineUtils.isNumber(zoom)) {
            zoom = TimelineUtils.keepInBounds(zoom, min, max);
            zoom = zoom || 1;
            this._currentZoom = zoom;
            return zoom;
        }

        return zoom;
    };

    /**
     * Set direct zoom value.
     * @public
     * @param zoom zoom value to set. percent 0-1 and etc.
     * @return normalized value.
     */
    setZoom = (zoom: number): number => {
        const prevZoom = this.getZoom();
        if (prevZoom !== zoom) {
            const zoomSet = this._setZoom(zoom);
            if (prevZoom != zoomSet) {
                this.rescale();
                this.redraw();
                return zoomSet;
            }
        }
        return prevZoom;
    };
    /**
     * Get current zoom level.
     */
    getZoom = (): number => {
        if (TimelineUtils.isNumber(this._currentZoom)) {
            return this._currentZoom || 1;
        }
        return 1;
    };
    _getClickDetectionRadius = (point: TimelineMouseData): number => {
        const defaultValue = this._consts.clickDetectionMinRadius || 1;
        return Math.max(defaultValue, point?.radius || defaultValue);
    };

    _handleContextMenu = (args: MouseEvent | TouchEvent): void => {
        // Prevent drag of the canvas if canvas is selected as text:
        TimelineUtils.clearBrowserSelection();
        if (!this._canvas || !this._scrollContainer) {
            this._cleanUpSelection();
            return;
        }
        const mousePosTimeline = this._trackMousePos(this._canvas, args);

        const clickRadius = this._getClickDetectionRadius(mousePosTimeline);
        const elements = this.elementFromPoint(mousePosTimeline.pos, clickRadius, []);

        const target = this._findDraggableElement(elements, mousePosTimeline.val);
        // Create click event
        const event = new TimelineClickEvent();
        event.point = mousePosTimeline;
        event.args = args;
        // all elements under the click:
        event.elements = elements;
        // target element.
        event.target = target;

        super.emit(TimelineEvents.ContextMenu, event);
    };

    /**
     * @param args
     */
    _handleMouseDownEvent = (args: MouseEvent | TouchEvent): void => {
        // 20250306: 右键点击不触发mousedown
        if ((<MouseEvent>args).button === 2) return;

        // Prevent drag of the canvas if canvas is selected as text:
        TimelineUtils.clearBrowserSelection();
        if (!this._canvas || !this._scrollContainer) {
            this._cleanUpSelection();
            return;
        }
        this._startPosMouseArgs = this._trackMousePos(this._canvas, args);

        if (!this._startPosMouseArgs) {
            return;
        }
        let isDoubleClick = Date.now() - this._lastClickTime < this._consts.doubleClickTimeoutMs;
        // Don't allow to perform double click if mouse was moved to far.
        if (
            this._lastClickPoint &&
            this._startPosMouseArgs &&
            TimelineUtils.getDistance(this._lastClickPoint.x, this._lastClickPoint.y, this._startPosMouseArgs.pos.x, this._startPosMouseArgs.pos.y) > this._consts.clickThreshold
        ) {
            isDoubleClick = false;
        }

        this._lastClickPoint = this._startPosMouseArgs.pos;
        this._scrollStartPos = { x: this._scrollContainer.scrollLeft, y: this._scrollContainer.scrollTop } as DOMPoint;
        this._clickAllowed = true;
        let onlyElements: TimelineElementType[] | null = null;
        if (this._interactionMode === TimelineInteractionMode.NonInteractivePan || this._interactionMode === TimelineInteractionMode.None) {
            // Allow to select only timeline. Timeline position can be disabled/enabled by properties.
            onlyElements = [TimelineElementType.Timeline];
        }
        const clickRadius = this._getClickDetectionRadius(this._startPosMouseArgs);
        const elements = this.elementFromPoint(this._startPosMouseArgs.pos, clickRadius, onlyElements);

        const target = this._findDraggableElement(elements, this._startPosMouseArgs.val);
        // Create click event
        const event = new TimelineClickEvent();
        event.point = this._startPosMouseArgs;
        event.args = args;
        // all elements under the click:
        event.elements = elements;
        // target element.
        event.target = target;

        if (isDoubleClick) {
            super.emit(TimelineEvents.DoubleClick, event);
            return;
        }

        super.emit(TimelineEvents.MouseDown, event);

        this._clickTimeout = Date.now();
        this._lastClickTime = Date.now();
        if (event.isPrevented()) {
            // Mouse up will be also prevented
            this._cleanUpSelection();
            return;
        }

        this._currentPos = this._startPosMouseArgs;

        // Select keyframes on mouse down
        if (target && this._interactionMode !== TimelineInteractionMode.Zoom) {
            this._drag = new TimelineDraggableData();
            this._drag.val = target.val;
            this._drag.type = target.type;
            this._drag.target = this._setElementDragState(target, target.val);

            if (target.type === TimelineElementType.Keyframe) {
                this._startedDragWithCtrl = this._controlKeyPressed(args);
                this._startedDragWithShiftKey = args.shiftKey;
                // get all related selected keyframes if we are selecting one.
                if (target?.keyframe && !target?.keyframe?.selected && !this._controlKeyPressed(args)) {
                    this._selectInternal(target.keyframe);
                }
                // Allow to drag all selected keyframes on a screen
                this._drag.elements = this.getSelectedElements().map((element) => {
                    return this._setElementDragState(element, element.val);
                });
            } else if (target.type === TimelineElementType.Group) {
                const keyframes = this._drag.target.keyframes;

                if (keyframes && Array.isArray(keyframes)) {
                    this._drag.elements = keyframes.map((keyframe) => {
                        return this._setElementDragState(this._convertToTimelineElement(this._drag?.target.row || null, keyframe), keyframe.val);
                    });
                }
            } else {
                this._drag.elements = [this._drag.target];
            }
        }

        this.redraw();
    };
    _setElementDragState = (element: TimelineElement | TimelineElementDragState, val: number): TimelineElementDragState => {
        const state = element as TimelineElementDragState;
        state.prevVal = state.val;
        if (state.startedVal === undefined || state.startedVal === null) {
            state.startedVal = val;
        }
        if (state.prevVal === undefined || state.prevVal === null) {
            state.prevVal = val;
        }
        state.val = val;
        return state;
    };
    /**
     * Check is mouse left button is clicked.
     */
    isLeftButtonClicked = (args: MouseEvent | TouchEvent | any): boolean => {
        return !!args && args.buttons == 1;
    };

    /**
     * Browser mouse move handler.
     */
    _handleMouseMoveEvent = (args: MouseEvent | TouchEvent | null): void => {
        if (!args) {
            args = this._lastUsedArgs;
        } else {
            this._lastUsedArgs = args;
        }
        if (!args || !this._canvas) {
            return;
        }
        const touchEventArgs = args as TouchEvent;
        const isTouch = touchEventArgs.changedTouches && touchEventArgs.changedTouches.length > 0;
        this._currentPos = this._trackMousePos(this._canvas, args);
        if (!this._isPanStarted && this._selectionRect && this._clickTimeoutIsOver()) {
            // TODO: implement selection by rect
            if (this._interactionMode === TimelineInteractionMode.None || this._interactionMode === TimelineInteractionMode.Zoom || this._interactionMode === TimelineInteractionMode.NonInteractivePan) {
                this._selectionRectEnabled = false;
            } else {
                this._selectionRectEnabled = true;
            }
        } else {
            this._selectionRectEnabled = false;
        }

        args = args as MouseEvent;
        const isLeftClicked = this.isLeftButtonClicked(args);
        if (!isLeftClicked) {
            this._scrollAreaClickOrDragStarted = false;
        }
        // On dragging is started.
        if (this._startPosMouseArgs) {
            // On left button is on hold by the user
            if (isLeftClicked || isTouch) {
                if (this._drag && !this._startedDragWithCtrl) {
                    const convertedVal = this._currentPos.val;
                    if (this._drag.type === TimelineElementType.Timeline) {
                        this._setTimeInternal(convertedVal, TimelineEventSource.User);
                    } else if ((this._drag.type == TimelineElementType.Keyframe || this._drag.type == TimelineElementType.Group) && this._drag.elements) {
                        const offset = Math.floor(convertedVal - this._drag.val);
                        const movedOffset = this._moveElements(offset, this._drag.elements, TimelineEventSource.User);
                        if (movedOffset !== 0) {
                            if (!this._drag.changed) {
                                this._drag.prevVal = this._drag.val;
                                const eventArgs = this._emitDragStartedEvent(this._drag);
                                if (!eventArgs || eventArgs.isPrevented()) {
                                    // Cleanup drag here, so drag finished will be ignored.
                                    this._cleanUpSelection(true);
                                    this._drag = null;
                                    return;
                                }
                            }

                            this._drag.changed = true;
                            this._drag.val += offset;
                            this._emitDragEvent(this._drag);
                        }
                    }
                }

                if ((this._interactionMode === TimelineInteractionMode.Pan || this._interactionMode === TimelineInteractionMode.NonInteractivePan) && !this._drag) {
                    this._isPanStarted = true;
                    this._setCursor(TimelineCursorType.Grabbing);
                    // Track scroll by drag.
                    this._scrollByPan(this._startPosMouseArgs.pos, this._currentPos.pos, this._scrollStartPos);
                } else {
                    if (this._interactionMode !== TimelineInteractionMode.None) {
                        // Track scroll by mouse or touch out of the area.
                        this._scrollBySelectionOutOfBounds(this._currentPos.pos);
                    }
                }

                this.redraw();
            } else {
                // Fallback. Cancel mouse move when focus was lost and mouse down is still counted.
                this._cleanUpSelection(true);
                this.redraw();
            }
        } else if (!isTouch) {
            // Set mouse over cursors
            let onlyElements: TimelineElementType[] | null = null;
            if (this._interactionMode === TimelineInteractionMode.NonInteractivePan || this._interactionMode === TimelineInteractionMode.None) {
                // Allow to select only timeline. Timeline position can be disabled/enabled by properties.
                onlyElements = [TimelineElementType.Timeline];
            }
            const clickRadius = this._getClickDetectionRadius(this._currentPos);
            const elements = this.elementFromPoint(this._currentPos.pos, clickRadius, onlyElements);
            const target = this._findDraggableElement(elements, this._currentPos.val);
            if (this._isPanStarted || this._interactionMode === TimelineInteractionMode.Pan || this._interactionMode === TimelineInteractionMode.NonInteractivePan) {
                if (isLeftClicked) {
                    this._setCursor(TimelineCursorType.Grabbing);
                } else {
                    this._setCursor(TimelineCursorType.Grab);
                }
            } else {
                if (this._interactionMode === TimelineInteractionMode.Zoom) {
                    this._setZoomCursor(args);
                    return;
                } else {
                    this._setCursor(TimelineCursorType.Default);
                }
            }

            if (target) {
                let cursor: TimelineCursorType | null = null;
                if (target.type === TimelineElementType.Group) {
                    cursor = cursor || TimelineCursorType.EWResize;
                } else if (target.type == TimelineElementType.Keyframe) {
                    cursor = cursor || TimelineCursorType.Pointer;
                } else if (target.type == TimelineElementType.Timeline) {
                    cursor = cursor || this._options?.timelineStyle?.cursor || null;
                }

                if (cursor) {
                    this._setCursor(cursor);
                }
            }
        }

        if (isTouch) {
            args.preventDefault();
        }
    };

    /**
     * Move elements
     * @param offset vector to move elements along.
     * @param elements Element to move.
     * @returns real moved value.
     */
    _moveElements(offset: number, elements: TimelineElementDragState[], source: TimelineEventSource = TimelineEventSource.Programmatically): number {
        if (!elements) {
            return 0;
        }
        let isChanged = false;
        if (Math.abs(offset) > 0) {
            // Find drag min and max bounds:
            let bounds = { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } as TimelineRanged;
            // Set min max from the options.
            bounds = TimelineUtils.setMinMax(bounds, this._options);
            elements.forEach((p) => {
                if (!p || !p.keyframe) {
                    return;
                }
                // find allowed bounds for the draggable items.
                // find for each row and keyframe separately.
                const currentBounds = TimelineUtils.setMinMax(TimelineUtils.setMinMax({ min: bounds.min, max: bounds.max }, p.keyframe), p.row || null);
                const expectedKeyframeValue = this._options?.snapAllKeyframesOnMove ? this.snapVal(p.keyframe.val) : p.keyframe.val;
                const newPosition = expectedKeyframeValue + offset;
                // Check that move offset will hit min bounds
                if ((currentBounds.min || currentBounds.min === 0) && TimelineUtils.isNumber(currentBounds.min) && newPosition < currentBounds.min) {
                    // Return to the bounds:
                    offset = offset + TimelineUtils.getDistance(currentBounds.min, newPosition);
                }
                if ((currentBounds.max || currentBounds.max === 0) && TimelineUtils.isNumber(currentBounds.max) && newPosition > currentBounds.max) {
                    // Return to the bounds:
                    offset = offset - TimelineUtils.getDistance(currentBounds.max, newPosition);
                }
            });

            if (Math.abs(offset) > 0) {
                // don't allow to move less than zero offset.
                elements.forEach((element) => {
                    if (!element?.keyframe) {
                        return;
                    }
                    const prevVal = element.keyframe.val;
                    const toSet = prevVal + offset;
                    const newValue = this._setKeyframePos(element, toSet, source);
                    isChanged = newValue !== prevVal;
                });
            }

            if (isChanged) {
                return offset;
            }
        }

        return 0;
    }

    /**
     * Mouse up handler.
     */
    _handleMouseUpEvent = (args: MouseEvent | TouchEvent): void => {
        this._scrollAreaClickOrDragStarted = false;
        if (!this._canvas) {
            return;
        }
        if (this._startPosMouseArgs) {
            //window.releaseCapture();
            const pos = this._trackMousePos(this._canvas, args);

            // Click detection.
            if (this._clickAllowed || !this._clickTimeoutIsOver() || (this._drag && (this._startedDragWithCtrl || this._startedDragWithShiftKey))) {
                if (this._options && this._interactionMode === TimelineInteractionMode.Zoom) {
                    const direction = this._controlKeyPressed(args) ? 1 : -1;
                    const mouseArgs = this._getMousePos(this._canvas, args);
                    const mousePos = Math.max(0, mouseArgs.pos.x || 0);
                    this._zoom(direction, this._options.zoomSpeed || 0, mousePos);
                } else {
                    this._performClick(pos, this._drag);
                }
            } else if (!this._drag && this._selectionRect && this._selectionRectEnabled) {
                if (this._interactionMode === TimelineInteractionMode.Zoom) {
                    // TODO: implement zoom by screen rect.
                } else if (this._interactionMode !== TimelineInteractionMode.None) {
                    const keyframes = this._getKeyframesByRectangle(this._selectionRect);
                    const selectionMode = args.shiftKey ? TimelineSelectionMode.Append : TimelineSelectionMode.Normal;
                    this.select(keyframes, selectionMode);
                }
            }

            this._cleanUpSelection();
            this.redraw();
        }
    };

    /**
     * Canvas client height.
     */
    _canvasClientHeight = (): number => {
        if (this._canvas) {
            return this._canvas.clientHeight;
        }
        return 0;
    };

    /**
     * Canvas client width.
     */
    _canvasClientWidth = (): number => {
        if (this._canvas) {
            return this._canvas.clientWidth;
        }
        return 0;
    };

    /**
     * Get all keyframes under the screen rectangle.
     * @param screenRect screen coordinates to get keyframes.
     */
    _getKeyframesByRectangle = (screenRect: DOMRect): TimelineKeyframe[] => {
        const keyframesModels: Array<TimelineKeyframe> = [];
        this._forEachKeyframe((keyframeViewModel) => {
            const intersects =
                keyframeViewModel.shape === TimelineKeyframeShape.Rect
                    ? TimelineUtils.isRectIntersects(keyframeViewModel.size, screenRect)
                    : TimelineUtils.isOverlap(keyframeViewModel.size.x, keyframeViewModel.size.y, screenRect);

            if (intersects) {
                keyframesModels.push(keyframeViewModel.model);
            }
        });
        return keyframesModels;
    };

    /**
     * Private.
     * Perform timeline click.
     */
    _performClick = (pos: TimelineMouseData, drag: TimelineDraggableData | null): boolean => {
        let isChanged = false;
        if (drag && drag.type === TimelineElementType.Keyframe) {
            let mode = TimelineSelectionMode.Normal;
            if (this._startedDragWithCtrl && this._controlKeyPressed(pos.args)) {
                if (this._controlKeyPressed(pos.args)) {
                    mode = TimelineSelectionMode.Revert;
                }
            } else if (this._startedDragWithShiftKey && pos.args.shiftKey) {
                mode = TimelineSelectionMode.Append;
            }
            // Reverse selected keyframe selection by a click:
            isChanged = this._selectInternal(drag?.target?.keyframe || null, mode).selectionChanged || isChanged;

            if (pos.args.shiftKey && this._options?.timelineDraggable !== false) {
                // Set current timeline position if it's not a drag or selection rect small or fast click.
                isChanged = this._setTimeInternal(pos.val, TimelineEventSource.User) || isChanged;
            }
        } else {
            // deselect keyframes if any:
            isChanged = this._selectInternal(null).selectionChanged || isChanged;

            if (this._options?.timelineDraggable !== false) {
                // change timeline pos:
                // Set current timeline position if it's not a drag or selection rect small or fast click.
                isChanged = this._setTimeInternal(pos.val, TimelineEventSource.User) || isChanged;
            }
        }

        return isChanged;
    };
    /**
     * Set keyframe value.
     * @param keyframe
     * @param value
     * @return set value.
     */
    _setKeyframePos = (element: TimelineElementDragState, value: number, source: TimelineEventSource = TimelineEventSource.Programmatically): number => {
        if (!element || !element.keyframe) {
            return value;
        }
        value = Math.floor(value);
        if (element.keyframe && element.keyframe.val != value) {
            element.prevVal = element.val;
            element.val = value;
            element.keyframe.val = value;
            const event = this._emitKeyframeChanged(element, source);
            if (event.isPrevented()) {
                element.val = event.prevVal;
                element.keyframe.val = event.prevVal;
            }

            return value;
        }

        return value;
    };

    /**
     * @param cursor to set.
     */
    _setCursor = (cursor: string): void => {
        if (this._canvas && this._canvas.style.cursor != cursor) {
            this._canvas.style.cursor = cursor;
        }
    };

    /**
     * Set component interaction mode.
     */
    public setInteractionMode = (mode: TimelineInteractionMode): void => {
        if (this._interactionMode != mode) {
            this._interactionMode = mode;
            // Avoid any conflicts with other modes, clean current state.
            this._cleanUpSelection(true);
            this.redraw();
        }
    };
    /**
     * Get current interaction mode.
     */
    public getInteractionMode = (): TimelineInteractionMode => {
        return this._interactionMode;
    };
    /**
     * Private.
     * Helper method. Convert model element  to timeline element.
     */
    _convertToTimelineElement = (rowModel: TimelineRow | null, keyframe: TimelineKeyframe): TimelineElement => {
        const data = {
            type: TimelineElementType.Keyframe,
            val: keyframe.val,
            keyframe: keyframe,
            row: rowModel,
        } as TimelineElement;
        return data;
    };

    public getSelectedKeyframes = (): TimelineKeyframe[] => {
        const selected = this.getSelectedElements();
        return selected.map((p) => p.keyframe) as TimelineKeyframe[];
    };

    /**
     * Get selected timeline elements.
     */
    public getSelectedElements = (): TimelineElement[] => {
        const selected: TimelineElement[] = [];
        this._forEachKeyframe((keyframe): void => {
            if (keyframe && keyframe.model.selected) {
                selected.push(this._convertToTimelineElement(keyframe.rowViewModel.model, keyframe.model));
            }
            return;
        });

        return selected;
    };
    /**
     * Get all keyframe models available in the model.
     */
    public getAllKeyframes = (): TimelineKeyframe[] => {
        const keyframes: TimelineKeyframe[] = [];
        this._forEachKeyframe((keyframe): void => {
            keyframes.push(keyframe.model);
        });

        return keyframes;
    };

    public selectAllKeyframes = (): TimelineSelectionResults => {
        return this.select(this.getAllKeyframes(), TimelineSelectionMode.Normal);
    };
    public deselectAll = (): TimelineSelectionResults => {
        return this.select(null);
    };

    private _changeNodeState = (state: TimelineSelectionResults, node: TimelineKeyframe, value: boolean): boolean => {
        if (node.selected !== value) {
            const selectable = typeof node.selectable === 'boolean' ? node.selectable : true;
            if (!value || (value && selectable)) {
                node.selected = value;
                state.changed.push(node);
                return true;
            }
        }

        return false;
    };

    public select = (nodes: TimelineKeyframe[] | TimelineKeyframe | null, mode = TimelineSelectionMode.Normal): TimelineSelectionResults => {
        const results = this._selectInternal(nodes, mode);
        if (results.selectionChanged) {
            this.redraw();
        }
        return results;
    };

    /**
     * Select keyframes
     * @param nodes keyframe or list of the keyframes to be selected.
     * @param mode selection mode.
     */
    public _selectInternal = (nodes: TimelineKeyframe[] | TimelineKeyframe | null, mode = TimelineSelectionMode.Normal): TimelineSelectionResults => {
        if (!nodes) {
            nodes = [];
        }
        if (!Array.isArray(nodes)) {
            nodes = [nodes];
        }

        const state = {
            selectionChanged: false,
            selected: this.getSelectedKeyframes(),
            changed: [] as Array<any>,
        } as TimelineSelectionResults;
        const nodesArray = nodes as TimelineKeyframe[];
        //const state = this.selectedSubject.getValue();
        if (nodesArray && mode === TimelineSelectionMode.Append) {
            nodes.forEach((node) => {
                const changed = this._changeNodeState(state, node, true);
                if (changed && node.selected) {
                    state.selected.push(node);
                }
            });
        } else if (nodesArray && mode === TimelineSelectionMode.Revert) {
            nodes.forEach((node) => {
                if (state.selected.indexOf(node) >= 0) {
                    this._changeNodeState(state, node, false);
                    TimelineUtils.deleteElement<TimelineKeyframe>(state.selected, node);
                } else {
                    this._changeNodeState(state, node, true);
                    if (node.selected) {
                        state.selected.push(node);
                    }
                }
            });
        } else if (mode === TimelineSelectionMode.Normal) {
            const selectedItems: Array<TimelineKeyframe> = [];
            if (nodes) {
                nodes.forEach((node) => {
                    this._changeNodeState(state, node, true);
                    if (node.selected) {
                        selectedItems.push(node);
                    }
                });
            }

            state.selected.forEach((node) => {
                const exists = nodesArray.indexOf(node) >= 0;
                // Deselect
                if (!exists) {
                    this._changeNodeState(state, node, false);
                }
            });

            if (state.changed.length > 0) {
                if (selectedItems) {
                    state.selected = selectedItems;
                } else {
                    state.selected.length = 0;
                }
            }
        }

        if (state.changed.length > 0) {
            state.selectionChanged = true;
            this._emitKeyframesSelected(state);
        }

        return state;
    };

    /**
     * foreach visible keyframe.
     */
    _forEachKeyframe(callback: (keyframe: TimelineKeyframeViewModel, index?: number, newRow?: boolean) => void, onRowCallback?: (rowViewModel: TimelineRowViewModel) => void): void {
        if (!callback && !onRowCallback) {
            return;
        }
        if (!this._model) {
            return;
        }

        const calculatedModel = this._generateViewModel();
        if (!calculatedModel) {
            return;
        }

        calculatedModel?.rowsViewModels?.forEach((rowViewModel) => {
            if (!rowViewModel) {
                return;
            }
            onRowCallback && onRowCallback(rowViewModel);
            let nextRow = true;
            if (callback) {
                rowViewModel.keyframesViewModels.forEach((keyframeViewModel, keyframeIndex) => {
                    if (keyframeViewModel) {
                        callback(keyframeViewModel, keyframeIndex, nextRow);
                    }

                    nextRow = false;
                });
            }
        });
    }

    /**
     * Private.
     * Create extended mouse position and calculate size of the selection rectangle.
     */
    _trackMousePos(canvas: HTMLCanvasElement, mouseArgs: MouseEvent | TouchEvent): TimelineMouseData {
        const clickArgs = this._getMousePos(canvas, mouseArgs);
        const pos = clickArgs.pos;
        clickArgs.originalVal = this._mousePosToVal(pos.x, false);
        clickArgs.snapVal = this._mousePosToVal(pos.x, true);
        clickArgs.val = clickArgs.originalVal;
        if (this._options && this._options.snapEnabled) {
            clickArgs.val = clickArgs.snapVal;
        }

        if (this._startPosMouseArgs) {
            if (!this._selectionRect) {
                this._selectionRect = {} as DOMRect;
            }
            const startPos = this._startPosMouseArgs.pos;
            // get the pos with the virtualization:
            const x = Math.floor(startPos.x + ((this._scrollStartPos?.x || 0) - this.scrollLeft));
            const y = Math.floor(startPos.y + ((this._scrollStartPos?.y || 0) - this.scrollTop));
            this._selectionRect.x = Math.min(x, pos.x);
            this._selectionRect.y = Math.min(y, pos.y);
            this._selectionRect.width = Math.max(x, pos.x) - this._selectionRect.x;
            this._selectionRect.height = Math.max(y, pos.y) - this._selectionRect.y;
            // Once mouse was moved outside of the bounds it's not a click anymore
            if (this._clickAllowed) {
                this._clickAllowed = this._selectionRect.height <= this._consts.clickThreshold && this._selectionRect.width <= this._consts.clickThreshold;
            }
        }

        return clickArgs;
    }

    /**
     * Get scroll container client width.
     */
    getClientWidth(): number {
        return this._scrollContainer?.clientWidth || 0;
    }
    /**
     * Get scroll container client height.
     */
    getClientHeight(): number {
        return this._scrollContainer?.clientHeight || 0;
    }
    _cleanUpSelection(forcePrevent = false): void {
        if (this._drag) {
            this._emitDragFinishedEvent(this._drag, forcePrevent);
        }
        this._startPosMouseArgs = null;
        this._drag = null;
        this._scrollAreaClickOrDragStarted = false;
        this._startedDragWithCtrl = false;
        this._startedDragWithShiftKey = false;
        this._selectionRect = null;
        this._clickTimeout = null;
        this._scrollStartPos = null;
        this._isPanStarted = false;
        this._clickAllowed = false;
        this._stopAutoPan();
    }

    /**
     * Check whether click timeout is over.
     */
    _clickTimeoutIsOver(): boolean {
        // Duration before the selection can be tracked.
        if (this._clickTimeout && Date.now() - this._clickTimeout > this._consts.clickDetectionMs) {
            return true;
        }

        return false;
    }

    /**
     * Automatically pan. Scroll canvas when selection is made and mouse outside of the bounds.
     */
    _startAutoPan = (): void => {
        if (this._consts.autoPanSpeed) {
            if (!this._intervalRef) {
                // Repeat move calls to
                this._intervalRef = window.setInterval(() => {
                    this._handleMouseMoveEvent(null);
                }, this._consts.autoPanSpeed);
            }
        }
    };

    /**
     * Stop current running auto pan
     */
    _stopAutoPan = (): void => {
        if (this._intervalRef) {
            clearInterval(this._intervalRef);
            this._intervalRef = null;
        }

        this._autoPanLastActionDate = 0;
    };

    /**
     * Check whether auto pan should be slowed down a bit.
     */
    _checkUpdateSpeedTooFast(): boolean {
        // Slow down updated a bit.
        if (this._autoPanLastActionDate && Date.now() - this._autoPanLastActionDate <= this._consts.autoPanSpeedLimit) {
            return true;
        }

        this._autoPanLastActionDate = Date.now();
        return false;
    }

    /**
     * Scroll virtual canvas when pan mode is enabled.
     */
    _scrollByPan(start: DOMPoint, pos: DOMPoint, scrollStartPos: DOMPoint | null): void {
        if (!start || !pos || !this._scrollContainer) {
            return;
        }
        let x = 0;
        let y = 0;
        if (scrollStartPos) {
            x = scrollStartPos.x;
            y = scrollStartPos.y;
        }
        const offsetX = Math.round(start.x - pos.x);
        const newLeft = x + offsetX;

        if (offsetX > 0) {
            this._rescaleInternal(newLeft + this._canvasClientWidth());
        }

        if (offsetX > 0 && newLeft + this._canvasClientWidth() >= this._scrollContainer.scrollWidth - 5) {
            this.scrollLeft = this._scrollContainer.scrollWidth;
        } else {
            this.scrollLeft = newLeft;
        }
        this.scrollTop = Math.round(y + start.y - pos.y);
    }

    _scrollBySelectionOutOfBounds(pos: DOMPoint): boolean {
        if (!this._scrollContainer) {
            return false;
        }
        const x = pos.x;
        const y = pos.y;
        let isChanged = false;
        let speedX = 0;
        let speedY = 0;
        // Small offset to start auto pan earlier.
        const bounds = this._consts.autoPanByScrollPadding;
        const isLeft = x <= bounds;
        const isRight = x >= this._canvasClientWidth() - bounds;
        const isTop = y <= bounds;
        const isBottom = y >= this._canvasClientHeight() - bounds;
        let newWidth: number | null = null;
        let newHeight: number | null = null;
        if (isLeft || isRight || isTop || isBottom) {
            // Auto move init
            this._startAutoPan();

            if (this._checkUpdateSpeedTooFast()) {
                return false;
            }

            const scrollSpeedMultiplier = isNaN(this._consts.scrollByDragSpeed) ? 1 : this._consts.scrollByDragSpeed;
            if (isLeft) {
                // Get normalized speed.
                speedX = -TimelineUtils.getDistance(x, bounds) * scrollSpeedMultiplier;
            } else if (isRight) {
                // Get normalized speed:
                speedX = TimelineUtils.getDistance(x, this._canvasClientWidth() - bounds) * scrollSpeedMultiplier;
                newWidth = this.scrollLeft + this._canvasClientWidth() + speedX;
            }

            if (isTop) {
                // Get normalized speed.
                speedY = (-TimelineUtils.getDistance(x, bounds) * scrollSpeedMultiplier) / 4;
            } else if (isBottom) {
                // Get normalized speed:
                speedY = (TimelineUtils.getDistance(x, this._canvasClientHeight() - bounds) * scrollSpeedMultiplier) / 4;
                newHeight = this._scrollContainer.scrollTop + this._canvasClientHeight();
            }
        } else {
            this._stopAutoPan();
        }

        if (newWidth || newHeight) {
            this._rescaleInternal(newWidth, newHeight, TimelineScrollSource.ScrollBySelection);
        }

        if (Math.abs(speedX) > 0) {
            this.scrollLeft = this._scrollContainer.scrollLeft + speedX;
            isChanged = true;
        }

        if (Math.abs(speedY) > 0) {
            this.scrollTop = this._scrollContainer.scrollTop + speedY;
            isChanged = true;
        }

        return isChanged;
    }

    /**
     * Convert screen pixel to value.
     */
    public pxToVal(px: number): number {
        if (!this._options) {
            return px;
        }
        let min = this._options.min || 0;
        if (!TimelineUtils.isNumber(min)) {
            min = 0;
        }
        const stepPx = this._options.stepPx || 0;
        if (stepPx === 0) {
            return px;
        }
        min *= this._currentZoom || 1;
        const steps = (this._options.stepVal || 0) * this._currentZoom || 1;
        const val = min + (px / stepPx) * steps;
        return val;
    }

    /**
     * Convert value to local screen component coordinates.
     */
    _toScreenPx = (val: number): number => {
        return this.valToPx(val) - this.scrollLeft + this._leftMargin();
    };
    /**
     * Convert screen local coordinates to a global value info.
     */
    _fromScreen = (px: number): number => {
        return this.pxToVal(this.scrollLeft + px - this._leftMargin());
    };
    /**
     * 将面积值转换为全局屏幕像素坐标。
     */
    public valToPx = (val: number): number => {
        if (!this._options || !this._options.stepPx) {
            return val;
        }
        let min = this._options.min || 0;
        if (!TimelineUtils.isNumber(min)) {
            min = 0;
        }
        min *= this._currentZoom || 1;
        const steps = (this._options.stepVal || 0) * this._currentZoom || 1;
        return (-min + val) * (this._options.stepPx / steps);
    };

    /**
     * 将值捕捉到最近的网格点。
     */
    public snapVal(val: number): number {
        // Snap a value if configured.
        if (this._options && this._options.snapEnabled && this._options.snapStep) {
            const stops = this._options.snapStep;
            const step = val / stops;
            const stepsFit = Math.round(step);
            const minSteps = Math.abs(this._options.min || 0) / this._options.snapStep;
            const minOffset = TimelineUtils.sign(this._options.min || 1) * (minSteps - Math.floor(minSteps)) * this._options.snapStep;
            val = Math.round(minOffset) + Math.round(stepsFit * stops);
        }

        val = TimelineUtils.keepInBounds(val, this._options.min, this._options.max);
        return val;
    }

    /**
     * Convert mouse position to the timeline units considering all the scrolling and offsets.
     */
    _mousePosToVal = (x: number, snapEnabled = false): number => {
        const mousePos = Math.min(x, this._canvasClientWidth());
        let convertedVal = this._fromScreen(mousePos);
        convertedVal = Math.round(convertedVal);
        if (snapEnabled) {
            convertedVal = this.snapVal(convertedVal);
        }

        return convertedVal;
    };

    /**
     * Format line gauge text.
     * Default formatting is HMS
     * @param ms milliseconds to convert.
     * @param isSeconds whether seconds are passed.
     */
    _formatUnitsText = (ms: number): string => {
        const sign = TimelineUtils.sign(ms) < 0 ? '-' : '';
        ms = Math.abs(ms);
        // 1- Convert to seconds:
        let seconds = ms / 1000;

        const year = Math.floor(seconds / (365 * 86400));
        seconds = seconds % (365 * 86400);

        const days = Math.floor(seconds / 86400);
        seconds = seconds % 86400;

        // 2- Extract hours:
        const hours = Math.floor(seconds / 3600); // 3,600 seconds in 1 hour
        seconds = seconds % 3600; // seconds remaining after extracting hours
        // 3- Extract minutes:
        const minutes = Math.floor(seconds / 60); // 60 seconds in 1 minute
        // 4- Keep only seconds not extracted to minutes:
        seconds = seconds % 60;
        let str = '';
        if (year) {
            str += year + ':';
        }

        if (days) {
            str += days + ':';
        }

        if (hours) {
            str += hours + ':';
        }

        if (minutes) {
            str += hours ? TimelineUtils.timePadZero(minutes) : minutes + ':';
        }

        if (!isNaN(seconds)) {
            str += minutes ? TimelineUtils.timePadZero(seconds) : seconds;
        }

        return sign + str;
    };
    /**
     * Left padding of the timeline.
     */
    _leftMargin = (): number => {
        return this._options?.leftMargin || 0;
    };
    /**
     * Private.
     * Render line gauge ticks.
     */
    _renderTicks = (): void => {
        if (!this._ctx || !this._ctx.canvas || this._ctx.canvas.clientWidth <= 0 || this._ctx.canvas.clientHeight <= 0 || !this._options || !this._options.stepPx) {
            return;
        }
        const screenWidth = this._canvasClientWidth() - this._leftMargin();
        let from = this.pxToVal(this.scrollLeft);
        let to = this.pxToVal(this.scrollLeft + screenWidth);
        if (isNaN(from) || isNaN(to) || from === to) {
            return;
        }

        if (to < from) {
            const wasToVal = to;
            to = from;
            from = wasToVal;
        }

        const valDistance = TimelineUtils.getDistance(from, to);
        if (valDistance <= 0) {
            return;
        }

        // Find the nearest 'beautiful' step for a gauge.
        // 'beautiful' step. Ex: should be dividable by 1/2/5/10!
        const step = TimelineUtils.findGoodStep(valDistance / (screenWidth / this._options.stepPx), 0, this._options?.denominators);

        // Find beautiful start point:
        const fromVal = Math.floor(from / step) * step;

        // Find a beautiful end point:
        const toVal = Math.ceil(to / step) * step + step;

        if (!TimelineUtils.isNumber(step) || step <= 0 || Math.abs(toVal - fromVal) === 0) {
            return;
        }
        let smallStep = 0;
        if (this._options.stepSmallPx) {
            smallStep = TimelineUtils.findGoodStep(valDistance / (screenWidth / this._options.stepSmallPx), 0, this._options?.denominators);
        }

        let lastTextStart = 0;
        this._ctx.save();
        const headerHeight = TimelineStyleUtils.headerHeight(this._options);
        const tickHeight = headerHeight / 2;
        const smallTickHeight = headerHeight / 1.3;
        for (let i = fromVal; i <= toVal; i += step) {
            // local
            const sharpPos = this._getSharp(this._toScreenPx(i));
            this._ctx.save();
            this._ctx.beginPath();
            this._ctx.setLineDash([4]);
            this._ctx.lineWidth = 1;
            if (this._options.tickColor) {
                this._ctx.strokeStyle = this._options.tickColor;
            }
            TimelineUtils.drawLine(this._ctx, sharpPos, tickHeight, sharpPos, headerHeight);
            this._ctx.stroke();
            if (this._options.labelsColor) {
                this._ctx.fillStyle = this._options.labelsColor;
            }
            if (this._options.font) {
                this._ctx.font = this._options.font;
            }

            const text = this._formatUnitsText(i);
            const textSize = this._ctx.measureText(text);

            const textX = sharpPos - textSize.width / 2;
            // skip text render if there is no space for it.
            if (isNaN(lastTextStart) || lastTextStart <= textX) {
                lastTextStart = textX + textSize.width;
                this._ctx.fillText(text, textX, remToPxNumber(1.1));
            }

            this._ctx.restore();
            if (!TimelineUtils.isNumber(smallStep) || smallStep <= 0) {
                continue;
            }
            // Draw small steps
            for (let x = i + smallStep; x < i + step; x += smallStep) {
                // local
                const nextSharpPos = this._getSharp(this._toScreenPx(x));
                this._ctx.beginPath();
                this._ctx.lineWidth = this._pixelRatio;
                if (this._options.tickColor) {
                    this._ctx.strokeStyle = this._options.tickColor;
                }
                TimelineUtils.drawLine(this._ctx, nextSharpPos, smallTickHeight, nextSharpPos, headerHeight);
                this._ctx.stroke();
            }
        }

        this._ctx.restore();
    };

    /**
     * Private.
     * Calculate virtual view model.
     * Determine screen positions for the model elements given.
     */
    _generateViewModel = (): TimelineViewModel => {
        const toReturn = {
            size: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            } as DOMRect,
            min: null,
            max: null,
            rowsViewModels: [],
            keyframesViewModels: [],
        } as TimelineViewModel;

        if (!this._model) {
            return toReturn;
        }
        const rows = this._model.rows;
        if (!rows || !Array.isArray(rows) || rows.length <= 0) {
            return toReturn;
        }
        let rowAbsoluteHeight = TimelineStyleUtils.headerHeight(this._options);
        rows.forEach((row, index) => {
            if (!row || row.hidden) {
                return;
            }

            // draw with scroll virtualization:
            const rowHeight = TimelineStyleUtils.getRowHeight(row.style || null, this._options);
            const marginBottom = TimelineStyleUtils.getRowMarginBottom(row.style || null, this._options);
            const currentRowY = rowAbsoluteHeight - (this._scrollContainer ? this._scrollContainer.scrollTop : 0);
            rowAbsoluteHeight += rowHeight + marginBottom;
            if (index == 0) {
                toReturn.size.y = currentRowY;
            }

            toReturn.size.height = Math.max(rowAbsoluteHeight + rowHeight, toReturn.size.height);
            const rowSize = { x: 0, y: currentRowY, width: this._canvasClientWidth(), height: rowHeight } as DOMRect;
            const rowViewModel = {
                size: rowSize,
                marginBottom: marginBottom,
                model: row,
                index: index,
                min: null,
                max: null,
                groupsViewModels: [],
                keyframesViewModels: [],
            } as TimelineRowViewModel;
            toReturn.rowsViewModels.push(rowViewModel);
            if (!row.keyframes || !row.keyframes.forEach || row.keyframes.length <= 0) {
                return;
            }

            // Get min and max ms to draw keyframe rows:
            if (row && row.keyframes) {
                row.keyframes.forEach((keyframe) => {
                    if (!keyframe || !TimelineUtils.isNumber(keyframe.val)) {
                        console.log('Unexpected null keyframe or having invalid value');
                        return;
                    }
                    if (keyframe.hidden) {
                        return;
                    }
                    let groupViewModel: TimelineGroupViewModel | null = rowViewModel.groupsViewModels?.find((p) => keyframe.group === p.groupModel) || null;
                    if (!groupViewModel) {
                        groupViewModel = {
                            min: keyframe.val,
                            max: keyframe.val,
                            size: null,
                            groupModel: keyframe.group,
                            keyframesViewModels: [],
                        } as TimelineGroupViewModel;
                        // TimelineStyleUtils.groupFillColor(rowViewModel.model.style || null, this._options);
                        rowViewModel.groupsViewModels.push(groupViewModel);
                    }
                    const keyframeShape = TimelineStyleUtils.keyframeShape(keyframe, keyframe.group, row.style || null, this._options);
                    const keyframeSize = this._getKeyframePosition(keyframe, groupViewModel, rowViewModel, keyframeShape);
                    const keyframeViewModel = {
                        model: keyframe,
                        rowViewModel: rowViewModel,
                        groupViewModel: groupViewModel,
                        size: keyframeSize,
                        shape: keyframeShape,
                    } as TimelineKeyframeViewModel;

                    const min = groupViewModel.min === null ? keyframe.val : Math.min(keyframe.val, groupViewModel.min);
                    const max = groupViewModel.max === null ? keyframe.val : Math.max(keyframe.val, groupViewModel.max);
                    if (TimelineUtils.isNumber(min)) {
                        groupViewModel.min = min;
                    }
                    if (TimelineUtils.isNumber(max)) {
                        groupViewModel.max = max;
                    }
                    // All keyframes in the row
                    rowViewModel.keyframesViewModels.push(keyframeViewModel);
                    // All keyframes in the group
                    groupViewModel.keyframesViewModels.push(keyframeViewModel);
                    // All keyframes in the component
                    toReturn.keyframesViewModels.push(keyframeViewModel);
                });
            }

            rowViewModel.groupsViewModels.forEach((groupViewModel) => {
                // Extend row min max bounds by a group bounds. It's used to notify needed visible bounds for the row.
                TimelineUtils.setMinMax(rowViewModel, groupViewModel, true);
                // get group screen coords
                const groupRect = this._getKeyframesGroupSize(groupViewModel, rowViewModel);
                groupViewModel.size = groupRect;
            });

            // Extend screen bounds by a current calculation:
            TimelineUtils.setMinMax(toReturn, rowViewModel, true);
        });
        if (TimelineUtils.isNumber(toReturn.max) && (toReturn.max || toReturn.max === 0)) {
            toReturn.size.width = this.valToPx(toReturn.max);
        }
        return toReturn;
    };

    /**
     * Render timeline rows.
     */
    _renderRows = (): void => {
        if (!this._ctx) {
            return;
        }
        const viewModel = this._generateViewModel();
        if (!viewModel?.rowsViewModels) {
            return;
        }
        try {
            this._ctx.save();

            viewModel.rowsViewModels.forEach((rowViewModel) => {
                if (!rowViewModel || !this._ctx) {
                    return;
                }

                this._ctx.fillStyle = TimelineStyleUtils.getRowFillColor(rowViewModel.model.style || null, this._options);
                //this._ctx.fillRect(data.areaRect.x, data.areaRect.y, data.areaRect.w, data.areaRect.h);
                // Note: bounds used instead of the clip while clip is slow!
                const bounds = this._cutBounds(rowViewModel.size);
                if (bounds?.rect) {
                    const rect = bounds?.rect;
                    this._ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
                }

                this._renderGroupBounds(rowViewModel);
            });
        } finally {
            this._ctx.restore();
        }
    };
    /**
     * Render group for the row.
     */
    _renderGroupBounds = (rowViewModel: TimelineRowViewModel): void => {
        if (!rowViewModel || !this._ctx) {
            return;
        }

        rowViewModel?.groupsViewModels?.forEach((groupsViewModels) => {
            if (!this._ctx) {
                return;
            }
            if ((groupsViewModels?.keyframesViewModels?.length || 0) <= 1) {
                return;
            }
            const groupFillColor = TimelineStyleUtils.groupFillColor(this._options, groupsViewModels.groupModel, rowViewModel?.model?.style);
            const strokeColor = TimelineStyleUtils.groupStrokeColor(this._options, groupsViewModels.groupModel, rowViewModel?.model?.style);
            let groupStrokeThickness = TimelineStyleUtils.groupStrokeThickness(this._options, groupsViewModels.groupModel, rowViewModel?.model?.style);
            const groupsRadii = TimelineStyleUtils.groupsRadii(this._options, groupsViewModels.groupModel, rowViewModel?.model?.style);
            if (!groupsViewModels.size) {
                console.log('Size of the group cannot be calculated');
                return;
            }

            try {
                this._ctx.save();

                // 获得画布的界限
                const rectBounds = this._cutBounds(groupsViewModels.size);
                if (rectBounds?.rect) {
                    const rect = rectBounds.rect;
                    if (!strokeColor) {
                        groupStrokeThickness = 0;
                    }
                    // Manipulate it again
                    this._ctx.strokeStyle = groupStrokeThickness > 0 ? strokeColor : '';
                    this._ctx.fillStyle = groupFillColor;
                    this._ctx.lineWidth = groupStrokeThickness;
                    // Different radii for each corner, top-left clockwise to bottom-left
                    this._ctx.beginPath();
                    // @ts-ignore
                    this._ctx.roundRect(rect.x + groupStrokeThickness, rect.y + groupStrokeThickness, rect.width - groupStrokeThickness, rect.height - groupStrokeThickness, groupsRadii);

                    this._ctx.fill();
                    if (groupStrokeThickness > 0) {
                        this._ctx.stroke();
                    }

                    // 20240813 组内容添加文本
                    const groupText = TimelineStyleUtils.groupText(this._options, groupsViewModels.groupModel, rowViewModel?.model?.style);
                    if (groupText && groupText.label) {
                        this._ctx.font = groupText.font || '10px sans-serif';
                        this._ctx.textBaseline = groupText.textBaseline || 'middle';
                        this._ctx.textAlign = groupText.textAlign || 'center';
                        this._ctx.direction = groupText.direction || 'inherit';
                        this._ctx.fillStyle = groupText.fillColor || "white";
                        // 预测量文本宽度
                        //const text = this._ctx.measureText(groupText.label);

                        if (groupText.isStroke) {
                            this._ctx.strokeText(groupText.label, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - groupStrokeThickness);
                        } else {
                            this._ctx.fillText(groupText.label, rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width - groupStrokeThickness);
                        }
                    }
                }
            } finally {
                this._ctx.restore();
            }
        });
    };
    /**
     * Method is used for the canvas drawing optimization.
     * Bounds are cut to draw only visible parts for the active canvas.
     */
    _cutBounds = (rect: DOMRect): TimelineCutBoundsRectResults | null => {
        if (!rect) {
            return null;
        }
        // default bounds: minX, maxX, minY, maxY
        const testOffset = 0;
        const minX = 0 + testOffset;
        const maxX = this._canvasClientWidth() - testOffset;
        const minY = TimelineStyleUtils.headerHeight(this._options) + testOffset;
        const maxY = this._canvasClientHeight() - testOffset;

        return this._cutBoundsWhenOverlap(rect, minX, maxX, minY, maxY);
    };
    _cutBoundsWhenOverlap = (rect: DOMRect, minX: number, maxX: number, minY: number, maxY: number): TimelineCutBoundsRectResults | null => {
        if (!rect) {
            return null;
        }

        if (
            // At the moment it's a check of top and left intersection.
            TimelineUtils.isRectIntersects(rect, {
                x: minX,
                y: minY,
                width: TimelineUtils.getDistance(minX, maxX),
                height: TimelineUtils.getDistance(minY, maxY),
            } as DOMRect)
        ) {
            const y = Math.max(rect.y, minY);
            const x = Math.max(rect.x, minX);
            const offsetW = rect.x - x;
            const offsetH = rect.y - y;

            return {
                rect: { height: rect.height + offsetH, width: rect.width + offsetW, x: x, y: y },
                overlapY: Math.abs(offsetH) > 0,
                overlapX: Math.abs(offsetW) > 0,
            } as TimelineCutBoundsRectResults;
        }
        return null;
    };
    /**
     * Calculate keyframe group screen rect size that is used during the rendering.
     * @param row
     * @param rowY row screen coords y position
     */
    _getKeyframesGroupSize = (groupViewModel: TimelineGroupViewModel, rowViewModel: TimelineRowViewModel): DOMRect => {
        const rowY = rowViewModel.size.y;
        const rowHeight = rowViewModel.size.height;
        const groupModel = groupViewModel.groupModel || null;
        let groupHeight = TimelineStyleUtils.groupHeight(this._options, groupModel, rowViewModel?.model?.style);

        let marginTop = TimelineStyleUtils.groupMarginTop(this._options, groupModel, rowViewModel?.model?.style);
        const isAutoHeight = groupHeight === 'auto';
        if (!groupHeight || isAutoHeight) {
            groupHeight = Math.floor(rowHeight);
        }
        groupHeight = typeof groupHeight === 'string' ? parseInt(groupHeight) : groupHeight;
        if (groupHeight > rowHeight) {
            groupHeight = rowHeight;
        }
        const isAutoMargin = marginTop === 'auto';
        if (typeof marginTop === 'string') {
            if (isAutoMargin) {
                marginTop = (rowHeight - groupHeight) / 2;
            } else {
                marginTop = parseInt(marginTop) || 0;
            }
        }

        if (!isAutoMargin) {
            if (isAutoHeight) {
                groupHeight -= marginTop * 2;
            }
        }

        // draw keyframes rows.
        const xMin = this._toScreenPx(groupViewModel.min); // local
        const xMax = this._toScreenPx(groupViewModel.max); // local

        return {
            x: xMin,
            y: rowY + marginTop,
            height: groupHeight,
            width: TimelineUtils.getDistance(xMin, xMax),
        } as DOMRect;
    };

    _getKeyframePosition = (keyframe: TimelineKeyframe, groupViewModel: TimelineGroupViewModel, rowViewModel: TimelineRowViewModel, keyframeShape: TimelineKeyframeShape): DOMRect | null => {
        if (!keyframe) {
            console.log('keyframe should be defined.');
            return null;
        }

        const val = keyframe.val;
        if (!TimelineUtils.isNumber(val)) {
            return null;
        }

        const rowSize = rowViewModel.size;
        // get center of the lane:
        let y = rowSize.y + rowSize.height / 2;
        const groupModel = groupViewModel?.groupModel || null;
        let height: number | string = TimelineStyleUtils.keyframeHeight(keyframe, groupModel, rowViewModel?.model?.style, this._options);
        let width: number | string = TimelineStyleUtils.keyframeWidth(keyframe, groupModel, rowViewModel?.model?.style, this._options);

        if (height === 'auto') {
            height = rowSize.height / 3;
        }
        if (width === 'auto') {
            width = height;
        }
        height = Number(height);
        if (!Number.isNaN(height) && height && (height as number) > 0) {
            const x = Math.floor(this._toScreenPx(val));
            y = Math.floor(y);
            const rect = {
                x: x, // local
                y: y,
                height: height,
                width: width,
            } as DOMRect;
            // Rect we are drawing in the center
            if (keyframeShape === TimelineKeyframeShape.Rect) {
                rect.y = rect.y - rect.height / 2;
                rect.x = rect.x - rect.width / 2;
            }
            return rect;
        }

        return null;
    };

    _renderKeyframes = (): void => {
        this._forEachKeyframe((keyframeViewModel) => {
            if (!this._ctx) {
                return;
            }
            const size = keyframeViewModel.size;

            if (size) {
                const x = this._getSharp(size.x);
                const y = size.y;
                const bounds = this._cutBounds({
                    x: x - size.width / 2,
                    y: y - size.height / 2,
                    width: size.width,
                    height: size.height,
                } as DOMRect);
                if (!bounds) {
                    return;
                }

                this._ctx.save();

                try {
                    // Performance FIX: use clip only  when we are in the collision! Clip is slow!
                    // Other keyframes should be hidden by bounds check.
                    // Note: clip with just render part of the keyframe
                    if (bounds && bounds.overlapY) {
                        this._ctx.beginPath();
                        this._ctx.rect(0, TimelineStyleUtils.headerHeight(this._options), this._canvasClientWidth(), this._canvasClientWidth());
                        this._ctx.clip();
                    }

                    this._renderKeyframe(this._ctx, keyframeViewModel);
                } finally {
                    this._ctx.restore();
                }
            }
        });
    };

    _renderKeyframe = (ctx: CanvasRenderingContext2D, keyframeViewModel: TimelineKeyframeViewModel): void => {
        const shape = keyframeViewModel.shape;
        if (shape === TimelineKeyframeShape.None) {
            return;
        }
        const size = keyframeViewModel.size;
        const x = this._getSharp(size.x);
        const y = size.y;

        const keyframe = keyframeViewModel.model;
        const row = keyframeViewModel.rowViewModel.model;
        const rowStyle = row.style || null;
        const groupModel = keyframeViewModel?.groupViewModel?.groupModel || null;
        const keyframeColor = keyframe.selected
            ? TimelineStyleUtils.keyframeSelectedFillColor(keyframe, groupModel, rowStyle, this._options)
            : TimelineStyleUtils.keyframeFillColor(keyframe, groupModel, rowStyle, this._options);
        const border = TimelineStyleUtils.keyframeStrokeThickness(keyframe, groupModel, rowStyle, this._options);
        let strokeColor = '';
        if (border > 0) {
            if (keyframe.selected) {
                strokeColor = TimelineStyleUtils.keyframeSelectedStrokeColor(keyframe, groupModel, rowStyle, this._options);
            } else {
                strokeColor = TimelineStyleUtils.keyframeStrokeColor(keyframe, groupModel, rowStyle, this._options);
            }
        }

        if (shape == TimelineKeyframeShape.Rhomb) {
            ctx.beginPath();
            ctx.translate(x, y);
            ctx.rotate((45 * Math.PI) / 180);
            if (border > 0 && strokeColor) {
                ctx.fillStyle = strokeColor;
                ctx.rect(-size.width / 2, -size.height / 2, size.width, size.height);
                ctx.fill();
            }

            ctx.fillStyle = keyframeColor;
            // draw main keyframe data with offset.
            ctx.translate(border, border);
            ctx.rect(-size.width / 2, -size.height / 2, size.width - border * 2, size.height - border * 2);
            ctx.fill();
        } else if (shape == TimelineKeyframeShape.Circle) {
            ctx.beginPath();
            if (border > 0 && strokeColor) {
                ctx.fillStyle = strokeColor;
                ctx.arc(x, y, size.height, 0, 2 * Math.PI);
            }
            ctx.fillStyle = keyframeColor;
            ctx.arc(x, y, size.height - border, 0, 2 * Math.PI);
            ctx.fill();
        } else if (shape == TimelineKeyframeShape.Rect) {
            ctx.beginPath();

            if (border > 0 && strokeColor) {
                ctx.fillStyle = strokeColor;
                ctx.rect(x, y, size.width, size.height);
                ctx.fill();
            }

            ctx.fillStyle = keyframeColor;
            ctx.rect(x + border, y + border, size.width - border, size.height - border);
            ctx.fill();
        }
    };

    _renderSelectionRect = (): void => {
        if (this._drag || !this._ctx || !this._canvas) {
            return;
        }
        this._ctx.save();
        const thickness = 1;
        if (this._selectionRect && this._selectionRectEnabled) {
            this._ctx.setLineDash([4]);
            this._ctx.lineWidth = this._pixelRatio;
            const selectionColor = this._options.selectionColor;
            if (selectionColor) {
                this._ctx.strokeStyle = selectionColor;
            }
            this._ctx.strokeRect(
                this._getSharp(this._selectionRect.x, thickness),
                this._getSharp(this._selectionRect.y, thickness),
                Math.floor(this._selectionRect.width),
                Math.floor(this._selectionRect.height),
            );
        }
        this._ctx.restore();
    };

    _renderBackground = (): void => {
        if (!this._ctx || !this._canvas) {
            return;
        }
        if (this._options.fillColor) {
            this._ctx.save();
            this._ctx.beginPath();
            this._ctx.rect(0, 0, this._canvasClientWidth(), this._canvasClientHeight());
            this._ctx.fillStyle = this._options.fillColor;
            this._ctx.fill();
            this._ctx.restore();
        } else {
            // Clear if bg not set.
            this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        }
    };

    _renderTimeline = (): void => {
        if (!this._ctx || !this._options || !this._options.timelineStyle) {
            return;
        }
        const style = this._options.timelineStyle;
        this._ctx.save();
        try {
            const thickness = style.width || 1;
            this._ctx.lineWidth = thickness * this._pixelRatio;
            const timeLinePos = this._getSharp(this._toScreenPx(this._val), thickness);
            if (style.strokeColor) {
                this._ctx.strokeStyle = style.strokeColor;
            }
            if (style.fillColor) {
                this._ctx.fillStyle = style.fillColor;
            }
            const y = style.marginTop || 0;
            const yBottom = style.marginBottom || 0;
            this._ctx.beginPath();
            const canvasHeight = this._canvasClientHeight() - yBottom;
            TimelineUtils.drawLine(this._ctx, timeLinePos, y, timeLinePos, canvasHeight);
            this._ctx.stroke();
            this._renderTimelineCap(timeLinePos, y);
        } finally {
            this._ctx.restore();
        }
    };
    /**
     * Render timeline cap top.
     */
    _renderTimelineCap = (timeLinePos: number, y: number): void => {
        const capStyle = this._options?.timelineStyle?.capStyle;
        if (!this._ctx || !capStyle) {
            return;
        }
        if (capStyle.capType === TimelineCapShape.None) {
            return;
        }
        this._ctx.save();
        try {
            const capSize = capStyle.width || 0;
            const capHeight = capStyle.height || 0;
            if (capSize && capHeight) {
                this._ctx.strokeStyle = capStyle.strokeColor || '';
                this._ctx.fillStyle = capStyle.fillColor || 'white';
                if (capStyle.capType === TimelineCapShape.Triangle) {
                    this._ctx.beginPath();
                    this._ctx.moveTo(timeLinePos - capSize / 2, y);
                    this._ctx.lineTo(timeLinePos + capSize / 2, y);
                    this._ctx.lineTo(timeLinePos, capHeight);
                    this._ctx.closePath();
                    this._ctx.stroke();
                } else if (capStyle.capType === TimelineCapShape.Rect) {
                    this._ctx.fillRect(timeLinePos - capSize / 2, y, capSize, capHeight);
                    this._ctx.fill();
                }
            }
        } finally {
            this._ctx.restore();
        }
    };
    _renderHeaderBackground = (): void => {
        if (!this._ctx || !this._options) {
            return;
        }
        if (TimelineStyleUtils.headerHeight(this._options)) {
            this._ctx.save();
            // draw ticks background
            this._ctx.lineWidth = this._pixelRatio;
            if (this._options.headerFillColor) {
                // draw ticks background
                this._ctx.lineWidth = this._pixelRatio;
                // draw header background
                this._ctx.fillStyle = this._options.headerFillColor;
                this._ctx.fillRect(0, 0, this._canvasClientWidth(), TimelineStyleUtils.headerHeight(this._options));
            } else {
                this._ctx.clearRect(0, 0, this._canvasClientWidth(), TimelineStyleUtils.headerHeight(this._options));
            }
            this._ctx.restore();
        }
    };

    redraw = (): void => {
        if (window?.requestAnimationFrame) {
            window.requestAnimationFrame(this._redrawInternal);
        } else {
            this._redrawInternal();
        }
    };

    /**
     * perform scroll to max right.
     */
    public scrollToRightBounds = (): void => {
        if (this._scrollContainer && this._scrollContainer.scrollLeft !== this._scrollContainer.scrollWidth) {
            this.scrollLeft = this._scrollContainer.scrollWidth;
        }
    };

    /**
     * Redraw parts of the component in the specific order.
     */
    _redrawInternal = (): void => {
        if (!this._ctx || !this._scrollContainer) {
            console.log('Context is not initialized');
            return;
        }
        // Rescale when animation is played out of the bounds.
        if (this.valToPx(this._val) > this._scrollContainer.scrollWidth) {
            this.rescale();
            if (!this._isPanStarted && this._drag && this._drag.type !== TimelineElementType.Timeline) {
                this.scrollToRightBounds();
            }
        }

        this._renderBackground();
        this._renderRows();
        // Render after rows
        this._renderHeaderBackground();
        this._renderTicks();
        this._renderKeyframes();
        this._renderSelectionRect();
        this._renderTimeline();
    };

    /**
     * Find sharp pixel position
     */
    _getSharp = (pos: number, thickness = 1): number => {
        pos = Math.round(pos);
        if (thickness % 2 == 0) {
            return pos;
        }

        return pos + this._pixelRatio / 2;
    };

    /**
     * Get current time:
     */
    public getTime = (): number => {
        return this._val;
    };

    /**
     * Set current time internal
     * @param val value.
     * @param source event source.
     */
    _setTimeInternal = (val: number, source: TimelineEventSource = TimelineEventSource.Programmatically): boolean => {
        if (!this._options) {
            return false;
        }
        val = Math.round(val);
        val = TimelineUtils.keepInBounds(val, this._options.min);
        if (this._val != val) {
            const prevVal = this._val;
            const timelineEvent = new TimelineTimeChangedEvent();
            timelineEvent.val = val;
            timelineEvent.prevVal = prevVal;
            timelineEvent.source = source;
            this._val = val;
            this.emit(TimelineEvents.TimeChanged, timelineEvent);
            if (timelineEvent.isPrevented()) {
                this._val = prevVal;
                return false;
            }
            return true;
        }

        return false;
    };
    public setTime = (val: number): boolean => {
        // don't allow to change time during drag:
        if (this._drag && this._drag.type === TimelineElementType.Timeline) {
            return false;
        }

        const isChanged = this._setTimeInternal(val, TimelineEventSource.SetTimeMethod);
        if (isChanged) {
            this.rescale();
            this.redraw();
        }

        return isChanged;
    };

    public getOptions = (): TimelineOptions => {
        return this._options;
    };

    /**
     * Current scroll left position.
     */
    public get scrollLeft(): number {
        return this._scrollContainer?.scrollLeft || 0;
    }
    public set scrollLeft(value: number) {
        if (this._scrollContainer && this._scrollContainer.scrollLeft !== value) {
            this._scrollProgrammatically = true;
            this._scrollContainer.scrollLeft = value;
        }
    }
    public get scrollTop(): number {
        return this._scrollContainer?.scrollTop || 0;
    }

    public set scrollTop(value: number) {
        if (this._scrollContainer && this._scrollContainer.scrollTop !== value) {
            this._scrollProgrammatically = true;
            this._scrollContainer.scrollTop = value;
        }
    }

    /**
     * Set options and render the component.
     * Note: Options will be merged\appended with the defaults and component will be invalidated/rendered again.
     */
    public setOptions = (toSet: TimelineOptions): TimelineOptions => {
        this._options = this._setOptions(toSet);
        this.rescale();
        this.redraw();
        // Merged options:
        return this._options;
    };

    /**
     * Private. Apply html container styles from options if any is set.
     */
    _applyContainersStyles = (): void => {
        if (this._scrollContainer && this._options) {
            const classList = this._scrollContainer.classList;
            if (this._options.scrollContainerClass && !classList.contains(this._options.scrollContainerClass)) {
                classList.add(this._options.scrollContainerClass);
            }
            if (this._options.fillColor) {
                this._scrollContainer.style.background = this._options.fillColor;
            }
        }
    };
    _setOptions = (toSet: TimelineOptions): TimelineOptions => {
        if (!toSet) {
            return this._options || {};
        }
        this._options = TimelineUtils.mergeOptions(this._options, toSet);
        // Normalize and validate spans per value.
        this._options.snapStep = TimelineUtils.keepInBounds(this._options.snapStep || 0, 0, this._options.stepVal || 0);
        this._currentZoom = this._setZoom(this._options.zoom || 0, this._options.zoomMin, this._options.zoomMax);
        this._options.min = TimelineUtils.isNumber(this._options.min) ? this._options.min : 0;
        this._options.max = TimelineUtils.isNumber(this._options.max) ? this._options.max : Number.MAX_VALUE;
        this._applyContainersStyles();
        // Prevent current active dragging of the timeline, while it's set that it's not allowed anymore.
        if (toSet.timelineDraggable === false) {
            if (this._drag && this._drag.type === TimelineElementType.Timeline) {
                this._cleanUpSelection();
            }
        }
        return this._options;
    };

    /**
     * Get current model.
     */
    public getModel = (): TimelineModel | null => {
        return this._model;
    };

    /**
     * Set model and redraw application.
     * @param data
     */
    public setModel = (data: TimelineModel): void => {
        this._model = data;
        this.rescale();
        this.redraw();
    };

    _getMousePos = (canvas: HTMLCanvasElement, e: TouchEvent | MouseEvent | any): TimelineMouseData => {
        let radius = 1;
        let clientX = 0;
        let clientY = 0;
        if (e.changedTouches && e.changedTouches.length > 0) {
            // TODO: implement better touch support
            const touch = e.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
            radius = Math.max(radius, touch.radiusX, touch.radiusY);
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect(), // abs. size of element
            scaleX = canvas.width / this._pixelRatio / rect.width, // relationship bitmap vs. element for X
            scaleY = canvas.height / this._pixelRatio / rect.height; // relationship bitmap vs. element for Y

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        // scale mouse coordinates after they have been adjusted to be relative to element
        return {
            pos: { x, y } as DOMPoint,
            radius,
            args: e,
        } as TimelineMouseData;
    };

    /**
     * Apply container div size to the container on changes detected.
     */
    _updateCanvasScale = (): boolean => {
        if (!this._scrollContainer || !this._container || !this._ctx) {
            console.log('Component should be initialized first.');
            return false;
        }
        let changed = false;
        const width = this._scrollContainer.clientWidth * this._pixelRatio;
        const height = this._scrollContainer.clientHeight * this._pixelRatio;
        if (Math.floor(width) != Math.floor(this._ctx.canvas.width)) {
            this._ctx.canvas.width = width;
            changed = true;
        }

        if (Math.floor(height) != Math.floor(this._ctx.canvas.height)) {
            this._ctx.canvas.height = height;
            changed = true;
        }

        if (changed) {
            this._ctx.setTransform(this._pixelRatio, 0, 0, this._pixelRatio, 0, 0);
        }
        return changed;
    };

    /**
     * Rescale and update size of the container.
     */
    public rescale = (): boolean => {
        return this._rescaleInternal();
    };

    /**
     * This method is used to draw additional space when after there are no keyframes.
     * When scrolled we should allow to indefinitely scroll right, so space should be extended to drag keyframes outside of the current size bounds.
     */
    _rescaleInternal = (newWidth: number | null = null, newHeight: number | null = null, scrollMode = TimelineScrollSource.DefaultMode): boolean => {
        let changed = this._updateCanvasScale();
        if (!this._scrollContent) {
            return changed;
        }
        const data = this._generateViewModel();
        if (data && data.size) {
            const additionalOffset = this._options.stepPx || 0;
            newWidth = newWidth || 0;
            // content should be not less than current timeline position + width of the timeline
            const timelineGlobalPos = this.valToPx(this._val) + this._leftMargin();
            let timelinePos = 0;
            const rightPosition = this.scrollLeft + this.getClientWidth();

            if (timelineGlobalPos >= rightPosition) {
                if (scrollMode == TimelineScrollSource.ScrollBySelection) {
                    // When item (timeline, selection rectangle) is just dragged to the right corner.
                    timelinePos = Math.floor(timelineGlobalPos + this._leftMargin());
                } else {
                    // When timeline is playing and we need to add next screen (when timeline goes out of the bounds.)
                    timelinePos = Math.floor(timelineGlobalPos + this.getClientWidth() + this._leftMargin());
                }
            }
            const keyframeW = data.size.width + this._leftMargin() + additionalOffset;

            newWidth = Math.max(
                // New expected component width.
                newWidth,
                // keyframes max width
                keyframeW,
                // not less than current scroll position
                rightPosition,
                timelinePos,
            );

            const minWidthPx = Math.floor(newWidth) + 'px';
            if (minWidthPx != this._scrollContent.style.minWidth) {
                this._scrollContent.style.minWidth = minWidthPx;
                changed = true;
            }

            newHeight = Math.max(
                // active size
                Math.floor(data.size.height + this._canvasClientHeight() * 0.2),
                (this._scrollContainer?.scrollTop || 0) + this._canvasClientHeight() - 1,
                Math.round(newHeight || 0),
            );

            const h = Math.floor(newHeight) + 'px';
            if (this._scrollContent.style.minHeight != h) {
                this._scrollContent.style.minHeight = h;
                return changed;
            }
        }
        return changed;
    };

    /**
     * Filter elements that can be dragged.
     * Filtration is done based on the timeline styles and options.
     */
    _filterDraggableElements = (elements: TimelineElement[]): TimelineElement[] => {
        // filter and sort: Timeline, individual keyframes, groups (distance).
        const filteredElements = elements.filter((element) => {
            if (!element) {
                return false;
            }
            if (element.type === TimelineElementType.Keyframe) {
                if (!TimelineStyleUtils.keyframeDraggable(element.keyframe || null, element.keyframe?.group || null, element?.row || null, this._options)) {
                    return false;
                }
            } else if (element.type === TimelineElementType.Group) {
                if (!TimelineStyleUtils.groupDraggable(element.group || null, element.row || null, this._options)) {
                    return false;
                }
            } else if (element.type === TimelineElementType.Timeline) {
                if (this._options?.timelineDraggable === false) {
                    return false;
                }
            } else if (element.type === TimelineElementType.Row) {
                return false;
            }
            return true;
        });
        return filteredElements;
    };
    /**
     * Filter and sort draggable elements by the priority to get first draggable element closest to the passed value.
     */
    _findDraggableElement = (elements: TimelineElement[], val: number | null = null): TimelineElement | null => {
        // filter and sort: Timeline, individual keyframes, groups (distance).
        const getPriority = (type: TimelineElementType): number => {
            if (type === TimelineElementType.Timeline) {
                return 1;
            } else if (type === TimelineElementType.Keyframe) {
                return 2;
            } else if (type === TimelineElementType.Group) {
                return 3;
            }
            return -1;
        };

        const sortDraggable = (a: TimelineElement, b: TimelineElement): number => {
            let prioA = getPriority(a.type);
            let prioB = getPriority(b.type);
            if (prioA === prioB) {
                if (val === null) {
                    return 0;
                }

                // Sort by distance
                prioA = TimelineUtils.getDistance(a.val, val);
                prioB = TimelineUtils.getDistance(b.val, val);
                if (prioA === prioB) {
                    return 0;
                }
                return prioA < prioB ? 1 : -1;
            }

            return prioA < prioB ? 1 : -1;
        };
        const sorted = this._filterDraggableElements(elements).sort(sortDraggable);
        if (sorted.length > 0) {
            return sorted[sorted.length - 1];
        }

        return null;
    };
    /**
     * get all clickable elements by the given local screen coordinate.
     */
    public elementFromPoint = (pos: DOMPoint, clickRadius: number, onlyTypes?: TimelineElementType[] | null): TimelineElement[] => {
        clickRadius = Math.max(clickRadius, 1);
        const toReturn: TimelineElement[] = [];

        if (!pos) {
            return toReturn;
        }

        const headerHeight = TimelineStyleUtils.headerHeight(this._options);
        // Check whether we can drag timeline.
        const timeLinePos = this._toScreenPx(this._val);
        let width = 0;
        const timelineStyle = this._options?.timelineStyle;
        if (timelineStyle) {
            width = Math.max((timelineStyle.width || 1) * this._pixelRatio, (timelineStyle?.capStyle?.width || 0) * this._pixelRatio || 1) + clickRadius;
        }
        // Allow to select timeline only by half of a header to allow select by a selector top most keyframes row.
        if (pos.y <= headerHeight * 0.5 || (pos.x >= timeLinePos - width / 2 && pos.x <= timeLinePos + width / 2)) {
            toReturn.push({
                val: this._val,
                type: TimelineElementType.Timeline,
            } as TimelineElement);
        }
        const snap = this._options.snapEnabled;
        if (pos.y >= headerHeight && this._options.keyframesDraggable) {
            this._forEachKeyframe(
                (keyframeViewModel, _, isNextRow): void => {
                    const rowViewModel = keyframeViewModel.rowViewModel;
                    // Check keyframes group overlap
                    if (isNextRow) {
                        if (rowViewModel.groupsViewModels) {
                            rowViewModel.groupsViewModels.forEach((groupViewModel) => {
                                if (!groupViewModel?.size) {
                                    return;
                                }
                                const keyframesGroupOverlapped = TimelineUtils.isOverlap(pos.x, pos.y, groupViewModel.size);
                                if (keyframesGroupOverlapped) {
                                    const keyframesModels = groupViewModel?.keyframesViewModels.map((p) => p.model) || [];
                                    const groupElement = {
                                        // TODO:
                                        val: this._mousePosToVal(pos.x, snap),
                                        type: TimelineElementType.Group,
                                        group: groupViewModel.groupModel,
                                        row: rowViewModel.model,
                                        keyframes: keyframesModels,
                                    } as TimelineElement;

                                    const snapped = this.snapVal(groupViewModel.min);
                                    // get snapped mouse pos based on a min value.
                                    groupElement.val += groupViewModel.min - snapped;
                                    toReturn.push(groupElement);
                                }
                            });
                        }
                    }

                    const keyframePosRect = keyframeViewModel.size;
                    if (keyframePosRect) {
                        let isMouseOver = false;
                        if (keyframeViewModel.shape === TimelineKeyframeShape.Rect) {
                            const extendedMouseRect = TimelineUtils.shrinkSelf({ x: pos.x, y: pos.y, height: clickRadius, width: clickRadius } as DOMRect, clickRadius);
                            isMouseOver = TimelineUtils.isRectIntersects(extendedMouseRect, keyframePosRect, true);
                        } else {
                            const dist = TimelineUtils.getDistance(keyframePosRect.x, keyframePosRect.y, pos.x, pos.y);
                            isMouseOver = dist <= keyframePosRect.height + clickRadius;
                        }
                        if (isMouseOver) {
                            toReturn.push({
                                keyframe: keyframeViewModel.model,
                                keyframes: [keyframeViewModel.model],
                                val: keyframeViewModel.model.val,
                                row: keyframeViewModel.rowViewModel.model,
                                type: TimelineElementType.Keyframe,
                            } as TimelineElement);
                        }
                    }
                },
                (rowViewModel) => {
                    const rowOverlapped = TimelineUtils.isOverlap(pos.x, pos.y, rowViewModel.size);
                    if (rowOverlapped) {
                        const row = {
                            val: this._mousePosToVal(pos.x, snap),
                            keyframes: rowViewModel.model.keyframes,
                            type: TimelineElementType.Row,
                            row: rowViewModel.model,
                        } as TimelineElement;
                        toReturn.push(row);
                    }
                },
            );
        }

        if (!onlyTypes || onlyTypes.length === 0) {
            return toReturn;
        } else {
            return toReturn.filter((p) => onlyTypes && onlyTypes.includes(p.type));
        }
    };

    /**
     * Subscribe user callback on time changed.
     */
    public onTimeChanged = (callback: (eventArgs: TimelineTimeChangedEvent) => void): void => {
        this.on(TimelineEvents.TimeChanged, callback);
    };
    /**
     * Subscribe user callback on drag started event.
     */
    public onDragStarted = (callback: (eventArgs: TimelineDragEvent) => void): void => {
        this.on(TimelineEvents.DragStarted, callback);
    };
    /**
     * Subscribe user callback on drag event.
     */
    public onDrag = (callback: (eventArgs: TimelineDragEvent) => void): void => {
        this.on(TimelineEvents.Drag, callback);
    };
    /**
     * Subscribe user callback on drag finished event.
     */
    public onDragFinished = (callback: (eventArgs: TimelineDragEvent) => void): void => {
        this.on(TimelineEvents.DragFinished, callback);
    };
    /**
     * Subscribe user callback on double click.
     */
    public onDoubleClick = (callback: (eventArgs: TimelineClickEvent) => void): void => {
        this.on(TimelineEvents.DoubleClick, callback);
    };
    /**
     * Subscribe user callback on keyframe changed event.
     */
    public onKeyframeChanged = (callback: (eventArgs: TimelineKeyframeChangedEvent) => void): void => {
        this.on(TimelineEvents.KeyframeChanged, callback);
    };
    /**
     * Subscribe user callback on drag finished event.
     */
    public onMouseDown = (callback: (eventArgs: TimelineClickEvent) => void): void => {
        this.on(TimelineEvents.MouseDown, callback);
    };

    /**
     * Subscribe user callback on selected.
     */
    public onSelected = (callback: (eventArgs: TimelineSelectedEvent) => void): void => {
        this.on(TimelineEvents.Selected, callback);
    };
    /**
     * Subscribe user callback on scroll event
     */
    public onScroll = (callback: (eventArgs: TimelineScrollEvent) => void): void => {
        this.on(TimelineEvents.Scroll, callback);
    };
    /**
     * Subscribe on scroll finished event.
     */
    public onScrollFinished = (callback: (eventArgs: TimelineScrollEvent) => void): void => {
        this.on(TimelineEvents.ScrollFinished, callback);
    };
    /**
     * Subscribe on canvas context menu event.
     */
    public onContextMenu = (callback: (eventArgs: TimelineClickEvent) => void): void => {
        this.on(TimelineEvents.ContextMenu, callback);
    };

    /**
     * Private.
     * Emit internally scroll eve
     */
    _emitScrollEvent = (args: Event | null, scrollProgrammatically: boolean, eventType = TimelineEvents.Scroll): TimelineScrollEvent => {
        const scrollEvent = {
            args: args,
            scrollProgrammatically: scrollProgrammatically,
            scrollLeft: this.scrollLeft,
            scrollTop: this.scrollTop,
            scrollHeight: this._scrollContainer?.scrollHeight || 0,
            scrollWidth: this._scrollContainer?.scrollWidth || 0,
        } as TimelineScrollEvent;
        super.emit(eventType, scrollEvent);
        return scrollEvent;
    };
    _emitKeyframeChanged = (element: TimelineElementDragState, source: TimelineEventSource = TimelineEventSource.Programmatically): TimelineKeyframeChangedEvent => {
        const args = new TimelineKeyframeChangedEvent();
        args.val = element.val;
        args.prevVal = element.prevVal;
        args.target = element;
        args.source = source;
        this.emit(TimelineEvents.KeyframeChanged, args);
        return args;
    };
    _emitDragStartedEvent = (dragState: TimelineDraggableData): TimelineDragEvent | null => {
        if (!dragState) {
            return null;
        }
        const args = this._getDragEventArgs(dragState, this._currentPos);
        this.emit(TimelineEvents.DragStarted, args);
        if (args.isPrevented()) {
            this._preventDrag(args, dragState, true);
        }
        return args;
    };
    /**
     * Private emit timeline event that dragging element is finished.
     * @param forcePrevent - needed when during dragging components set to the state when they cannot be dragged anymore. (used only as recovery state).
     * @returns
     */
    _emitDragFinishedEvent = (dragState: TimelineDraggableData, forcePrevent = false): TimelineDragEvent | null => {
        if (!dragState || !dragState.changed) {
            return null;
        }
        const args = this._getDragEventArgs(dragState, this._currentPos);
        if (forcePrevent) {
            args.preventDefault();
        }
        this.emit(TimelineEvents.DragFinished, args);
        if (args.isPrevented()) {
            this._preventDrag(args, dragState, true);
        }
        return args;
    };
    _preventDrag = (dragArgs: TimelineDragEvent, data: TimelineDraggableData, toStart = false): void => {
        if (dragArgs.elements) {
            dragArgs.elements.forEach((element) => {
                const toSet = toStart ? element.startedVal : element.prevVal;
                this._setKeyframePos(element, toSet);
            });
        }
        data.val = data.prevVal;
        // Set prev active point
        dragArgs.point = dragArgs.prevPoint;
    };
    _emitDragEvent = (dragState: TimelineDraggableData): TimelineDragEvent | null => {
        if (!dragState) {
            return null;
        }
        const args = this._getDragEventArgs(dragState, this._currentPos);
        this.emit<TimelineDragEvent>(TimelineEvents.Drag, args);
        if (args.isPrevented()) {
            this._preventDrag(args, dragState, false);
        }
        return args;
    };
    _emitKeyframesSelected = (state: TimelineSelectionResults): TimelineSelectedEvent => {
        const args = new TimelineSelectedEvent();
        args.selected = state.selected;
        args.changed = state.changed;
        this.emit<TimelineSelectedEvent>(TimelineEvents.Selected, args);
        return args;
    };
    _getDragEventArgs = (dragState: TimelineDraggableData, point: TimelineMouseData | null): TimelineDragEvent => {
        const draggableArguments = new TimelineDragEvent();
        draggableArguments.point = point;
        // Get cloned list
        draggableArguments.elements = [...(dragState.elements || [])];
        draggableArguments.target = dragState?.target || null;
        return draggableArguments;
    };
}
