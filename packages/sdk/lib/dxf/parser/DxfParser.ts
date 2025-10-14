import { Readable } from 'stream';
import DxfArrayScanner, { IGroup } from './DxfArrayScanner';
import AUTO_CAD_COLOR_INDEX from './AutoCadColorIndex';
import dimStyleCodes from './DimStyleCodes';

import Face from './entities/3dface';
import Arc from './entities/arc';
import AttDef from './entities/attdef';
import Attribute from './entities/attribute'
import Circle from './entities/circle';
import Dimension from './entities/dimension';
import Ellipse from './entities/ellipse';
import Hatch from './entities/hatch';
import Insert from './entities/insert';
import Line from './entities/line';
import LWPolyline from './entities/lwpolyline';
import MText from './entities/mtext';
import Point from './entities/point';
import Polyline from './entities/polyline';
import Solid from './entities/solid';
import Spline from './entities/spline';
import Text from './entities/text';
import Vertex from './entities/vertex';

import log from '#/utils/log/Logger';
import IGeometry, { EntityName, IEntity, IPoint } from './entities/geomtry';

export interface IBlock {
    entities: IEntity[];
    type: number;
    ownerHandle: string;
    // entities: any[];
    xrefPath: string;
    name: string;
    name2: string;
    handle: string;
    layer: string;
    position: IPoint;
    paperSpace: boolean;
}

export interface IViewPort {
    name: string;
    lowerLeftCorner: IPoint;
    upperRightCorner: IPoint;
    center: IPoint;
    snapBasePoint: IPoint;
    snapSpacing: IPoint;
    gridSpacing: IPoint;
    viewDirectionFromTarget: IPoint;
    viewTarget: IPoint;
    lensLength: number;
    frontClippingPlane: string | number | boolean;
    backClippingPlane: string | number | boolean;
    viewHeight: number;
    snapRotationAngle: number;
    viewTwistAngle: number;
    orthographicType: string;
    ucsOrigin: IPoint;
    ucsXAxis: IPoint;
    ucsYAxis: IPoint;
    renderMode: string;
    defaultLightingType: string;
    defaultLightingOn: string;
    ownerHandle: string;
    ambientColor: number;
    viewMode: string;
}

export interface IViewPortTableDefinition {
    tableRecordsProperty: 'viewPorts';
    tableName: 'viewPort';
    dxfSymbolName: 'VPORT';

    parseTableRecords(): IViewPort[];
}

export interface ILineType {
    name: string;
    description: string;
    pattern: string[];
    patternLength: number;
}

export interface ILineTypeTableDefinition {
    tableRecordsProperty: 'lineTypes';
    tableName: 'lineType';
    dxfSymbolName: 'LTYPE';

    parseTableRecords(): Record<string, ILineType>;
}

export interface ILayer {
    name: string;
    visible: boolean;
    colorIndex: number;
    color: number;
    frozen: boolean;
}

export interface ILayerTableDefinition {
    tableRecordsProperty: 'layers';
    tableName: 'layer';
    dxfSymbolName: 'LAYER';

    parseTableRecords(): Record<string, ILayer>;
}

export interface ITableDefinitions {
    VPORT: IViewPortTableDefinition;
    LTYPE: ILineTypeTableDefinition;
    LAYER: ILayerTableDefinition;
    DIMSTYLE: any;
    STYLE: any;
}

export interface IBaseTable {
    handle: string;
    ownerHandle: string;
}

export interface IViewPortTable extends IBaseTable {
    viewPorts: IViewPort[];
}

export interface ILayerTypesTable extends IBaseTable {
    lineTypes: Record<string, ILineType>;
}

export interface ILayersTable extends IBaseTable {
    layers: Record<string, ILayer>;
}

export interface ITables {
    viewPort: IViewPortTable;
    lineType: ILayerTypesTable;
    layer: ILayersTable;
}

export type ITable = IViewPortTable | ILayerTypesTable | ILayersTable;

export interface IDxf {
    header: Record<string, IPoint | number>;
    entities: IEntity[];
    blocks: Record<string, IBlock>;
    tables: ITables;
}

function registerDefaultEntityHandlers(dxfParser: DxfParser) {
    // 这里支持的实体(一些实体代码仍然被重构到这个流中)
    dxfParser.registerEntityHandler(Face);
    dxfParser.registerEntityHandler(Arc);
    dxfParser.registerEntityHandler(AttDef);
    dxfParser.registerEntityHandler(Attribute);
    dxfParser.registerEntityHandler(Circle);
    dxfParser.registerEntityHandler(Dimension);
    dxfParser.registerEntityHandler(Ellipse);
    dxfParser.registerEntityHandler(Hatch);
    dxfParser.registerEntityHandler(Insert);
    dxfParser.registerEntityHandler(Line);
    dxfParser.registerEntityHandler(LWPolyline);
    dxfParser.registerEntityHandler(MText);
    dxfParser.registerEntityHandler(Point);
    dxfParser.registerEntityHandler(Polyline);
    dxfParser.registerEntityHandler(Solid);
    dxfParser.registerEntityHandler(Spline);
    dxfParser.registerEntityHandler(Text);
    dxfParser.registerEntityHandler(Vertex);
}

export default class DxfParser {
    private _entityHandlers = {} as Record<EntityName, IGeometry>;

    constructor() {
        registerDefaultEntityHandlers(this);
    }

    public parse(source: string | Readable) {
        if (typeof source === 'string') {
            return this._parse(source);
        } else {
            log.error('无法读取dxf源的类型: `' + typeof (source));
            return null;
        }
    }

    public registerEntityHandler(handlerType: new () => IGeometry) {
        const instance = new handlerType();
        this._entityHandlers[instance.ForEntityName] = instance;
    }

    public parseSync(source: string) {
        return this.parse(source);
    }

    public parseStream(stream: Readable) {
        let dxfString = "";
        const self = this;
        return new Promise<IDxf>((res, rej) => {

            stream.on('data', (chunk) => {
                dxfString += chunk;
            });
            stream.on('end', () => {
                try {
                    res(self._parse(dxfString));
                } catch (err) {
                    rej(err);
                }
            });
            stream.on('error', (err) => {
                rej(err);
            });
        });
    }

    private _parse(dxfString: string) {
        const dxf = {} as IDxf;
        let lastHandle = 0;
        const dxfLinesArray = dxfString.split(/\r\n|\r|\n/g);

        const scanner = new DxfArrayScanner(dxfLinesArray);
        if (!scanner.hasNext()) {
            log.error('当前 CAD 文件为空文件');
            return dxf;
        }

        const self = this;
        let curr: IGroup;

        function parseAll() {
            curr = scanner.next();
            while (!scanner.isEOF()) {
                if (curr.code === 0 && curr.value === 'SECTION') {
                    curr = scanner.next();

                    // 确保我们读的是段代码
                    if (curr.code !== 2) {
                        log.error(`Unexpected code ${debugCode(curr)} after 0:SECTION`);
                        curr = scanner.next();
                        continue;
                    }

                    if (curr.value === 'HEADER') {
                        dxf.header = parseHeader();
                    } else if (curr.value === 'BLOCKS') {
                        dxf.blocks = parseBlocks();
                    } else if (curr.value === 'ENTITIES') {
                        dxf.entities = parseEntities(false);
                    } else if (curr.value === 'TABLES') {
                        dxf.tables = parseTables();
                    } else if (curr.value === 'EOF') {
                        log.debug('EOF');
                    } else {
                        log.warn('Skipping section ' + curr.value);
                    }
                } else {
                    curr = scanner.next();
                }
                // If is a new section
            }
        }

        /**
         *
         * @return {object} header
         */
        function parseHeader() {
            // interesting variables:
            //  $ACADVER, $VIEWDIR, $VIEWSIZE, $VIEWCTR, $TDCREATE, $TDUPDATE
            // http://www.autodesk.com/techpubs/autocad/acadr14/dxf/header_section_al_u05_c.htm
            // Also see VPORT table entries
            let currVarName = null as null | string;
            let currVarValue = null as null | IPoint | number;
            const header = {} as Record<string, IPoint | number>;
            // loop through header variables
            curr = scanner.next();

            while (true) {
                if (groupIs(curr, 0, 'ENDSEC')) {
                    if (currVarName) header[currVarName as string] = currVarValue!;
                    break;
                } else if (curr.code === 9) {
                    if (currVarName) header[currVarName as string] = currVarValue!;
                    currVarName = curr.value as string;
                    // Filter here for particular variables we are interested in
                } else {
                    if (curr.code === 10) {
                        currVarValue = { x: curr.value as number } as IPoint;
                    } else if (curr.code === 20) {
                        (currVarValue as IPoint).y = curr.value as number;
                    } else if (curr.code === 30) {
                        (currVarValue as IPoint).z = curr.value as number;
                    } else {
                        currVarValue = curr.value as number;
                    }
                }
                curr = scanner.next();
            }
            // console.log(util.inspect(header, { colors: true, depth: null }));
            curr = scanner.next(); // swallow up ENDSEC
            return header;
        }

        function parseBlocks() {
            const blocks = {} as Record<string, IBlock>;

            curr = scanner.next();

            while (curr.value !== 'EOF') {
                if (groupIs(curr, 0, 'ENDSEC')) {
                    break;
                }

                if (groupIs(curr, 0, 'BLOCK')) {
                    const block = parseBlock();
                    ensureHandle(block);
                    if (!block.name) {
                        // log.error('block with handle "' + block.handle + '" is missing a name.');
                        // block.name = 'InvalidBlockName-' + block.ownerHandle;
                    } else {
                        blocks[block.name] = block;
                    }
                } else {
                    logUnhandledGroup(curr);
                    curr = scanner.next();
                }
            }
            return blocks;
        }

        function parseBlock() {
            const block = {} as IBlock;
            curr = scanner.next();

            while (curr.value !== 'EOF') {
                switch (curr.code) {
                    case 1:
                        block.xrefPath = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 2:
                        block.name = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 3:
                        block.name2 = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 5:
                        block.handle = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 8:
                        block.layer = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 10:
                        block.position = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 67:
                        block.paperSpace = (curr.value && curr.value == 1) ? true : false;
                        curr = scanner.next();
                        break;
                    case 70:
                        if (curr.value != 0) {
                            //if(curr.value & BLOCK_ANONYMOUS_FLAG) console.log('  Anonymous block');
                            //if(curr.value & BLOCK_NON_CONSTANT_FLAG) console.log('  Non-constant attributes');
                            //if(curr.value & BLOCK_XREF_FLAG) console.log('  Is xref');
                            //if(curr.value & BLOCK_XREF_OVERLAY_FLAG) console.log('  Is xref overlay');
                            //if(curr.value & BLOCK_EXTERNALLY_DEPENDENT_FLAG) console.log('  Is externally dependent');
                            //if(curr.value & BLOCK_RESOLVED_OR_DEPENDENT_FLAG) console.log('  Is resolved xref or dependent of an xref');
                            //if(curr.value & BLOCK_REFERENCED_XREF) console.log('  This definition is a referenced xref');
                            block.type = curr.value as number;
                        }
                        curr = scanner.next();
                        break;
                    case 100:
                        // ignore class markers
                        curr = scanner.next();
                        break;
                    case 330:
                        block.ownerHandle = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 0:
                        if (curr.value == 'ENDBLK')
                            break;
                        block.entities = parseEntities(true);
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                }

                if (groupIs(curr, 0, 'ENDBLK')) {
                    curr = scanner.next();
                    break;
                }
            }
            return block;
        }

        /**
         * parseTables
         * @return {Object} Object representing tables
         */
        function parseTables() {
            const tables = {} as ITables;
            curr = scanner.next();
            while (curr.value !== 'EOF') {
                if (groupIs(curr, 0, 'ENDSEC'))
                    break;

                if (groupIs(curr, 0, 'TABLE')) {
                    curr = scanner.next();

                    const tableDefinition = tableDefinitions[curr.value as keyof ITableDefinitions];
                    if (tableDefinition) {
                        tables[tableDefinitions[curr.value as keyof ITableDefinitions].tableName] = parseTable(curr);
                    } else {
                        // log.debug('Unhandled Table ' + curr.value);
                    }
                } else {
                    // else ignored
                    curr = scanner.next();
                }
            }

            curr = scanner.next();
            return tables;
        }

        const END_OF_TABLE_VALUE = 'ENDTAB';

        function parseTable<T extends IBaseTable = ITable>(group: IGroup) {
            const tableDefinition = tableDefinitions[group.value as keyof ITableDefinitions];
            const table = {} as T;
            let expectedCount = 0;

            curr = scanner.next();
            while (!groupIs(curr, 0, END_OF_TABLE_VALUE)) {
                switch (curr.code) {
                    case 5:
                        table.handle = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 330:
                        table.ownerHandle = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 100:
                        if (curr.value === 'AcDbSymbolTable') {
                            // ignore
                            curr = scanner.next();
                        } else {
                            logUnhandledGroup(curr);
                            curr = scanner.next();
                        }
                        break;
                    case 70:
                        expectedCount = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 0:
                        if (curr.value === tableDefinition.dxfSymbolName) {
                            table[tableDefinition.tableRecordsProperty] = tableDefinition.parseTableRecords();
                        } else {
                            logUnhandledGroup(curr);
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                }
            }
            const tableRecords = table[tableDefinition.tableRecordsProperty];
            if (tableRecords) {
                let actualCount = (() => {
                    if (tableRecords.constructor === Array) {
                        return tableRecords.length;
                    } else if (typeof (tableRecords) === 'object') {
                        return Object.keys(tableRecords).length;
                    }
                    return undefined;
                })();
                if (expectedCount !== actualCount) log.warn('Parsed ' + actualCount + ' ' + tableDefinition.dxfSymbolName + '\'s but expected ' + expectedCount);
            }
            curr = scanner.next();
            return table;
        }

        function parseViewPortRecords() {
            const viewPorts = [] as IViewPort[]; // 多个表项可以具有相同的名称，表示多个视区配置
            let viewPort = {} as IViewPort;

            curr = scanner.next();
            while (!groupIs(curr, 0, END_OF_TABLE_VALUE)) {

                switch (curr.code) {
                    case 2: // 视口名
                        viewPort.name = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 10: // 视口的左下角
                        viewPort.lowerLeftCorner = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 11: // 视口右上角
                        viewPort.upperRightCorner = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 12: // 视口中心点（在 DCS 中）
                        viewPort.center = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 13: // 捕捉基点（在 DCS 中）
                        viewPort.snapBasePoint = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 14: // 捕捉间距 X 和 Y
                        viewPort.snapSpacing = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 15: // 栅格间距 X 和 Y
                        viewPort.gridSpacing = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 16: // 相对于目标点的观察方向（在 WCS 中）
                        viewPort.viewDirectionFromTarget = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 17: //观察目标点（在 WCS 中）
                        viewPort.viewTarget = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 42: // 焦距
                        viewPort.lensLength = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 43: //前向剪裁平面（距目标点的偏移）
                        viewPort.frontClippingPlane = curr.value;
                        curr = scanner.next();
                        break;
                    case 44: // 后向剪裁平面（距目标点的偏移）
                        viewPort.backClippingPlane = curr.value;
                        curr = scanner.next();
                        break;
                    case 45: // 视图高度
                        viewPort.viewHeight = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 50: // 捕捉旋转角度
                        viewPort.snapRotationAngle = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 51: // 视图扭转角度
                        viewPort.viewTwistAngle = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 71: // 视图模式（参见 VIEWMODE 系统变量）
                        viewPort.viewMode = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 79: // UCS 的正交类型  0 = UCS 不正交 1 = 俯视图；2 = 仰视图 3 = 主视图；4 = 后视图 5 = 左视图；6 = 右视图
                        viewPort.orthographicType = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 110: // UCS 原点（在 DCS 中）
                        viewPort.ucsOrigin = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 111: // UCS X 轴
                        viewPort.ucsXAxis = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 112: // UCS Y 轴
                        viewPort.ucsYAxis = parsePoint(curr);
                        curr = scanner.next();
                        break;
                    case 281:
                        /*
                        * 渲染模式： 0 = 二维优化（传统二维） 1 = 线框图 2 = 隐藏线 3 = 平面着色 4 = 体着色 5 = 带线框平面着色 6 = 带线框体着色
                        * 所有非二维优化渲染模式均使用新三维图形管道。这些值直接与 SHADEMODE 命令和 AcDbAbstractViewTableRecord::RenderMode 枚举相对应
                        */
                        viewPort.renderMode = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 292:
                        viewPort.defaultLightingOn = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 330:
                        viewPort.ownerHandle = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 63: // These are all ambient color. Perhaps should be a gradient when multiple are set.
                    case 421:
                    case 431:
                        viewPort.ambientColor = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 0:
                        // New ViewPort
                        if (curr.value === 'VPORT') {
                            viewPorts.push(viewPort);
                            viewPort = {} as IViewPort;
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                        break;
                }
            }
            // Note: do not call scanner.next() here,
            //  parseTable() needs the current group
            viewPorts.push(viewPort);

            return viewPorts;
        }

        function parseLineTypes() {
            const ltypes = {} as Record<string, ILineType>;
            let ltype = {} as ILineType;
            let length = 0;
            let ltypeName: string;

            curr = scanner.next();
            while (!groupIs(curr, 0, 'ENDTAB')) {

                switch (curr.code) {
                    case 2:
                        ltype.name = curr.value as string;
                        ltypeName = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 3:
                        ltype.description = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 73: // Number of elements for this line type (dots, dashes, spaces);
                        length = curr.value as number;
                        if (length > 0) ltype.pattern = [];
                        curr = scanner.next();
                        break;
                    case 40: // total pattern length
                        ltype.patternLength = curr.value as number;
                        curr = scanner.next();
                        break;
                    case 49:
                        ltype.pattern.push(curr.value as string);
                        curr = scanner.next();
                        break;
                    case 0:
                        if (length > 0 && length !== ltype.pattern.length) log.warn('lengths do not match on LTYPE pattern');
                        ltypes[ltypeName!] = ltype;
                        ltype = {} as ILineType;
                        curr = scanner.next();
                        break;
                    default:
                        curr = scanner.next();
                }
            }

            ltypes[ltypeName!] = ltype;
            return ltypes;
        }

        function parseLayers() {
            const layers = {} as Record<string, ILayer>;
            let layer = {} as ILayer;
            let layerName: string | undefined;

            curr = scanner.next();
            while (!groupIs(curr, 0, 'ENDTAB')) {

                switch (curr.code) {
                    case 2: // layer name
                        layer.name = curr.value as string;
                        layerName = curr.value as string;
                        curr = scanner.next();
                        break;
                    case 62: // color, visibility
                        // @ts-ignore
                        layer.visible = curr.value >= 0;
                        // TODO 0 and 256 are BYBLOCK and BYLAYER respectively. Need to handle these values for layers?.
                        layer.colorIndex = Math.abs(curr.value as number);
                        layer.color = getAcadColor(layer.colorIndex as number);
                        curr = scanner.next();
                        break;
                    case 70: // frozen layer
                        layer.frozen = (((curr.value as number) & 1) != 0 || ((curr.value as number) & 2) != 0);
                        curr = scanner.next();
                        break;
                    case 0:
                        // New Layer
                        if (curr.value === 'LAYER') {
                            layers[layerName!] = layer;
                            layer = {} as ILayer;
                            layerName = undefined;
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                        break;
                }
            }
            // Note: do not call scanner.next() here,
            //  parseLayerTable() needs the current group
            layers[layerName!] = layer;

            return layers;
        }

        function parseDimStyles() {
            let dimStyles = {},
                styleName: string | undefined,
                style: any = {};

            curr = scanner.next();
            while (!groupIs(curr, 0, 'ENDTAB')) {
                if (dimStyleCodes.has(curr.code)) {
                    style[dimStyleCodes.get(curr.code) as string] = curr.value
                    curr = scanner.next();
                } else {
                    switch (curr.code) {
                        case 2: // style name
                            style.name = curr.value;
                            styleName = curr.value as string;
                            curr = scanner.next();
                            break;
                        case 0:
                            // New style
                            if (curr.value === 'DIMSTYLE') {
                                // @ts-ignore
                                dimStyles[styleName] = style;
                                style = {};
                                styleName = undefined;
                                curr = scanner.next();
                            }
                            break;
                        default:
                            logUnhandledGroup(curr);
                            curr = scanner.next();
                            break;
                    }
                }
            }
            // Note: do not call scanner.next() here,
            //  parseLayerTable() needs the current group
            dimStyles[styleName as string] = style;

            return dimStyles;
        }

        const parseStyles = function () {
            const styles = {};
            let style: any = {};
            let styleName;

            curr = scanner.next();
            while (!groupIs(curr, 0, END_OF_TABLE_VALUE)) {
                switch (curr.code) {
                    case 100:
                        style.subClassMarker = curr.value;
                        curr = scanner.next();
                        break;
                    case 2:
                        style.styleName = curr.value;
                        styleName = curr.value;
                        curr = scanner.next();
                        break;
                    case 70:
                        style.standardFlag = curr.value;
                        curr = scanner.next();
                        break;
                    case 40:
                        style.fixedTextHeight = curr.value;
                        curr = scanner.next();
                        break;
                    case 41:
                        style.widthFactor = curr.value;
                        curr = scanner.next();
                        break;
                    case 50:
                        style.obliqueAngle = curr.value;
                        curr = scanner.next();
                        break;
                    case 71:
                        style.textGenerationFlag = curr.value;
                        curr = scanner.next();
                        break;
                    case 42:
                        style.lastHeight = curr.value;
                        curr = scanner.next();
                        break;
                    case 3:
                        style.font = curr.value;
                        curr = scanner.next();
                        break;
                    case 4:
                        style.bigFont = curr.value;
                        curr = scanner.next();
                        break;
                    case 1071:
                        style.extendedFont = curr.value;
                        curr = scanner.next();
                        break;
                    case 0:
                        if (curr.value === 'STYLE') {
                            styles[styleName] = style;
                            style = {};
                            styleName = undefined;
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                        break;
                }
            }
            styles[styleName] = style;
            return styles;
        };

        const tableDefinitions = {
            VPORT: {
                tableRecordsProperty: 'viewPorts',
                tableName: 'viewPort',
                dxfSymbolName: 'VPORT',
                parseTableRecords: parseViewPortRecords
            },
            LTYPE: {
                tableRecordsProperty: 'lineTypes',
                tableName: 'lineType',
                dxfSymbolName: 'LTYPE',
                parseTableRecords: parseLineTypes
            },
            LAYER: {
                tableRecordsProperty: 'layers',
                tableName: 'layer',
                dxfSymbolName: 'LAYER',
                parseTableRecords: parseLayers
            },
            DIMSTYLE: {
                tableRecordsProperty: 'dimStyles',
                tableName: 'dimstyle',
                dxfSymbolName: 'DIMSTYLE',
                parseTableRecords: parseDimStyles
            },
            STYLE: {
                tableRecordsProperty: 'styles',
                tableName: 'style',
                dxfSymbolName: 'STYLE',
                parseTableRecords: parseStyles,
            },
        } as ITableDefinitions;

        /**
         * 在解析器首次读取0:ENTITIES组后调用。扫描器应该已经在第一个实体的开始。
         * @return {Array} the resulting entities
         */
        function parseEntities(forBlock: boolean) {
            const entities = [] as IEntity[];

            const endingOnValue = forBlock ? 'ENDBLK' : 'ENDSEC';

            if (!forBlock) {
                curr = scanner.next();
            }
            while (true) {
                if (curr.code === 0) {
                    if (curr.value === endingOnValue) {
                        break;
                    }

                    const handler = self._entityHandlers[curr.value as EntityName];
                    if (handler != null) {
                        const entity = handler.parseEntity(scanner, curr);
                        curr = scanner.lastReadGroup!;
                        ensureHandle(entity);
                        entities.push(entity);
                    } else {
                        // log.debug('Unhandled entity ' + curr.value);
                        curr = scanner.next();
                        continue;
                    }
                } else {
                    // ignored lines from unsupported entity
                    curr = scanner.next();
                }
            }
            if (endingOnValue == 'ENDSEC') curr = scanner.next(); // swallow up ENDSEC, but not ENDBLK
            return entities;
        }

        /**
         * 解析一个2D或3D点.
         * 如果它是3D的，将其作为具有x， y和（有时）z属性的对象返回。
         * 假定当前组是被读入点的x，并且scanner.next（）将返回y。
         * 解析器将自动确定是否存在z点。
         * @return {Object} 二维或三维点作为具有 x、y[,z] 的对象
         */
        function parsePoint(curr: IGroup) {
            const point = {} as IPoint;
            let code = curr.code;

            point.x = curr.value as number;

            code += 10;
            curr = scanner.next();
            if (curr.code != code)
                throw new Error('Expected code for point value to be ' + code +
                    ' but got ' + curr.code + '.');
            point.y = curr.value as number;

            code += 10;
            curr = scanner.next();
            if (curr.code != code) {
                scanner.rewind();
                return point;
            }
            point.z = curr.value as number;

            return point;
        }

        function ensureHandle(entity: IEntity | IBlock) {
            if (!entity) throw new TypeError('entity cannot be undefined or null');

            if (!entity.handle) entity.handle = lastHandle++;
        }

        parseAll();
        return dxf;
    }
}

function groupIs(group: IGroup, code: number, value: string | number | boolean) {
    return group.code === code && group.value === value;
}

// @ts-ignore
function logUnhandledGroup(curr: IGroup) {
    // log.debug('unhandled group ' + debugCode(curr));
}


function debugCode(curr: IGroup) {
    return curr.code + ':' + curr.value;
}

/**
 * Returns the truecolor value of the given AutoCad color index value
 * @return {Number} truecolor value as a number
 */
function getAcadColor(index: number) {
    return AUTO_CAD_COLOR_INDEX[index];
}

// const BLOCK_ANONYMOUS_FLAG = 1;
// const BLOCK_NON_CONSTANT_FLAG = 2;
// const BLOCK_XREF_FLAG = 4;
// const BLOCK_XREF_OVERLAY_FLAG = 8;
// const BLOCK_EXTERNALLY_DEPENDENT_FLAG = 16;
// const BLOCK_RESOLVED_OR_DEPENDENT_FLAG = 32;
// const BLOCK_REFERENCED_XREF = 64;


/* Notes */
// Code 6 of an entity indicates inheritance of properties (eg. color).
//   BYBLOCK means inherits from block
//   BYLAYER (default) mean inherits from layer
