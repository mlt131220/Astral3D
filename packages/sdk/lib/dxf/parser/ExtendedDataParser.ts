import log from '#/utils/log/Logger';

export default class ExtendedDataParser {
    private appName: null;
    private appNameWarningShown: boolean;
    private lastString: any;
    private sectionStack: { values: any[] }[];
    private failure: boolean;

    constructor() {
        this.appName = null
        this.appNameWarningShown = false
        this.lastString = null
        this.sectionStack = [this._CreateSection()]
        this.failure = false
    }

    /**
     * Feed next token.
     * @return {boolean} 如果应该为此令牌创建新的解析器实例，则为True。
     */
    Feed(curr) {
        if (!this.appName) {
            if (curr.code == 1001) {
                this.appName = curr.value
                return false
            }
            if (!this.appNameWarningShown) {
                this.appNameWarningShown = true
                log.warn("XDATA部分不以应用程序名称开头")
            }
            return false
        }

        if (curr.code == 1001) {
            return true
        }

        if (this.failure) {
            /* Ignore all the rest content in case of parsing failure. */
            return false
        }

        if (curr.code == 1000) {
            if (this.lastString) {
                log.warn("XDATA section unused string: " + this.lastString)
            }
            this.lastString = curr.value
            return false
        }

        const curSection = this._currentSection

        if (curr.code == 1002) {
            if (curr.value == "{") {
                if (!this.lastString) {
                    log.warn("Unnamed XDATA section encountered")
                    this.failure = true
                    return false
                }
                const newSection = this._CreateSection()
                curSection[this.lastString] = newSection
                this.lastString = null
                this.sectionStack.push(newSection)
                return false
            }
            if (curr.value == "}") {
                if (this.sectionStack.length < 2) {
                    log.warn("Unmatched XDATA section closing")
                    this.failure = true
                    return false
                }
                this.sectionStack.length = this.sectionStack.length - 1
                return false
            }
            log.warn("Bad XDATA section control string encountered: " + curr.value)
            this.failure = true
            return false
        }

        if (this.lastString !== null) {
            curSection.values.push(this._CreateValue(1000, this.lastString))
            this.lastString = null
        }

        curSection.values.push(this._CreateValue(curr.code, curr.value))

        return false
    }

    /** Finalize XDATA section parsing. */
    Finish(entity) {
        if (this.failure) {
            return
        }
        if (this.appName) {
            let xdata
            if (entity.hasOwnProperty("xdata")) {
                xdata = entity.xdata
            } else {
                xdata = {}
                entity.xdata = xdata
            }
            xdata[this.appName] = this.sectionStack[0]
        }
    }

    get _currentSection() {
        return this.sectionStack[this.sectionStack.length - 1]
    }

    _CreateSection() {
        return {
            values: []
        }
    }

    _CreateValue(code, value) {
        return { code, value }
    }
}
