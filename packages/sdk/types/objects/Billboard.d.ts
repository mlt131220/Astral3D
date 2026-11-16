declare namespace IBillboard {
    interface options {
        name: string;
        position: number[],
        image:{
            url?:string,
            visible:boolean,
            width:number,
            height:number,
            rotate:number,
            margin:number,
            position:string,
            top:boolean,
        },
        text:{
            value:string,
            visible:boolean,
            fontSize:number,
            fontColor:string,
            fontFamily?:string,
            fontWeight:string | number,
            fontStyle:string,
            lineGap:number,
            padding:number,
            align:CanvasTextAlign,
            baseline:CanvasTextBaseline,
            strokeWidth:number,
            strokeColor:string,
            fill:boolean,
            fillColor:string,
        }
    }
}
