import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

module powerbi.extensibility.visual {


    window["requestAnimFrame"] = (function () {
        return window.requestAnimationFrame ||
            window["webkitRequestAnimationFrame"] ||
            window["mozRequestAnimationFrame"] ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    window["cancelAnimFrame"] = (function () {//cancelAnimationFrame Polyfill
        return window.cancelAnimationFrame ||
            window["webkitCancelAnimationFrame"] ||
            window["mozCancelAnimationFrame"] ||
            function (id) {
                window.clearTimeout(id);
            };
    })();


    interface VisualViewModel {
        dataPoints: VisualDataPoint[];
        settings: VisualSettings;
    };

    interface VisualDataPoint {
        categoryText: string;
        measureAbsolute: number;
        measureDeviation: number[];
        measureAbsoluteFormatted: string;
        measureDeviationFormatted: string[];
    };

    interface customPositive {
        use: boolean;
        when: string;
        value: string;
    }

    interface VisualSettings {
        scroller: {
            pShouldAutoSizeFont: boolean;
            pShouldIndicatePosNeg: boolean;
            pShouldUsePosNegColoring: boolean;
            pShouldUseTextColoring: boolean;
            pFontSize: number;
            pSpeed: number;
            pCustomText: string;
            pForeColor: Fill;
            pBgColor: Fill;
            positiveColour: Fill;
            negativeColour: Fill;
            pInterval: number;
        },

        determinePositive: {
            custom: customPositive[];
        },

        headers: {
            headers: string[];
        }
    }

    export interface TextCategory {
        txtCategory: string;
        txtDataAbsoluteFormatted: string;
        txtDataRelativeFormatted: string;
        txtSplitChar: string[];
        txtSeparator: string;
        colText: string;
        colStatus: string[];
        posX: number;
        svgSel: d3.Selection<SVGElement>;
        sCategory: d3.Selection<SVGElement>;
        sDataAbsoluteFormatted: d3.Selection<SVGElement>;
        sDataRelativeFormatted: d3.Selection<SVGElement>;
        sSplitChar: d3.Selection<SVGElement>;
        sSeparator: d3.Selection<SVGElement>;
        sHeaders: d3.Selection<SVGElement>[];
        centeredLines: d3.Selection<SVGElement>[];
        actualWidth: number;
        offset: number;
        categorySize: number;
        headerOffsets: number[];
        headerSizes: number[];
        statusSize: number;
        firstAbsoluteValue: d3.Selection<SVGElement>;
    }

    function getMeasureIndex(dv: DataViewCategorical, measureName: string): number {
        let RetValue: number = -1;
        for (let i = 0; i < dv.values.length; i++) {
            if (dv.values[i].source.roles[measureName] === true) {
                RetValue = i;
                break;
            }
        }
        return RetValue;
    }

    //This is the function that is responsible for dealing with the data that is being passed in
    function visualTransform(options: VisualUpdateOptions, host: IVisualHost, thisRef: Visual): VisualViewModel {
        let dataViews = options.dataViews;
        let defaultSettings: VisualSettings = {
            scroller: {
                pShouldAutoSizeFont: false,
                pShouldIndicatePosNeg: true,
                pShouldUsePosNegColoring: true,
                pShouldUseTextColoring: false,
                pFontSize: 20,
                pSpeed: 1.2,
                pCustomText: "",
                pForeColor: { solid: { color: "#ffffff" } },
                pBgColor: { solid: { color: "#000000" } },
                positiveColour: { solid: { color: "#96C401" } },
                negativeColour: { solid: { color: "#DC0002" } },
                pInterval: 50
            },
            determinePositive: {
                custom: []
            },
            headers: {
                headers: []
            }
        };
        let viewModel: VisualViewModel = {
            dataPoints: [],
            settings: <VisualSettings>{},
        };

        if (!dataViews[0]) {
            return viewModel;
        }


        let objects = dataViews[0].metadata.objects;
        let visualSettings: VisualSettings = {
            scroller: {
                pShouldAutoSizeFont: getValue<boolean>(objects, 'text', 'pShouldAutoSizeFont', defaultSettings.scroller.pShouldAutoSizeFont),
                pShouldIndicatePosNeg: getValue<boolean>(objects, 'status', 'pShouldIndicatePosNeg', defaultSettings.scroller.pShouldIndicatePosNeg),
                pShouldUsePosNegColoring: getValue<boolean>(objects, 'status', 'pShouldUsePosNegColoring', defaultSettings.scroller.pShouldUsePosNegColoring),
                pShouldUseTextColoring: getValue<boolean>(objects, 'status', 'pShouldUseTextColoring', defaultSettings.scroller.pShouldUseTextColoring),
                pFontSize: getValue<number>(objects, 'text', 'pFontSize', defaultSettings.scroller.pFontSize),
                pSpeed: getValue<number>(objects, 'scroller', 'pSpeed', defaultSettings.scroller.pSpeed),
                pCustomText: getValue<string>(objects, 'text', 'pCustomText', defaultSettings.scroller.pCustomText),
                pForeColor: getValue<Fill>(objects, 'colour', 'pForeColor', defaultSettings.scroller.pForeColor),
                pBgColor: getValue<Fill>(objects, 'colour', 'pBgColor', defaultSettings.scroller.pBgColor),
                positiveColour: getValue<Fill>(objects, 'colour', 'positiveColour', defaultSettings.scroller.positiveColour),
                negativeColour: getValue<Fill>(objects, 'colour', 'negativeColour', defaultSettings.scroller.negativeColour),
                pInterval: getValue<number>(objects, 'scroller', 'pInterval', defaultSettings.scroller.pInterval)
            },
            determinePositive: {
                custom: [{
                    use: getValue<boolean>(objects, 'determinePositive', "custom", false),
                    when: getValue<string>(objects, 'determinePositive', "when", ">"),
                    value: getValue<string>(objects, 'determinePositive', "value", undefined)
                },
                {
                    use: getValue<boolean>(objects, 'determinePositive', "custom2", false),
                    when: getValue<string>(objects, 'determinePositive', "when2", ">"),
                    value: getValue<string>(objects, 'determinePositive', "value2", undefined)
                }]
            },
            headers: {
                headers: [getValue<string>(objects, 'headers', 'header1', ""), getValue<string>(objects, 'headers', 'header2', undefined), getValue<string>(objects, 'headers', 'header3', undefined)].filter(x => x !== undefined)
            }
        }
        viewModel.settings = visualSettings;

        if (!dataViews[0]
            || !dataViews[0].categorical
            || !dataViews[0].categorical.values) {
            return viewModel;
        }

        // Set property limits
        if (visualSettings.scroller.pFontSize > 1000) {
            visualSettings.scroller.pFontSize = 1000;
        } else if (visualSettings.scroller.pFontSize < 0) {
            visualSettings.scroller.pFontSize = 0;
        }

        if (visualSettings.scroller.pSpeed > 1000) {
            visualSettings.scroller.pSpeed = 1000;
        } else if (visualSettings.scroller.pSpeed < 0) {
            visualSettings.scroller.pSpeed = 0;
        }

        let categorical = dataViews[0].categorical;
        let category = typeof (categorical.categories) === 'undefined' ? null : categorical.categories[0];
        let dataValue = categorical.values[0];

        let measureAbsoluteIndex = getMeasureIndex(categorical, "Measure Absolute");
        let measureDeviationStartIndex = getMeasureIndex(categorical, "Measure Deviation");

        // If we dont have a category, set a default one
        if (category === null) {
            let tmp: DataViewCategoryColumn = {
                source: null,
                values: []
            };
            category = tmp;
            category.values = [];
            category.values.push("");
        }

        let visualDataPoints: VisualDataPoint[] = [];

        var countOfMeasures;

        //Change the loop to retrieve the multiple Deviation values instead of just the one
        for (let i = 0, len = Math.max(category.values.length, dataValue.values.length); i < len; i++) {
            var measureAbs = measureAbsoluteIndex > -1 ? <number>categorical.values[measureAbsoluteIndex].values[i] : null;
            var measureAbsForm = measureAbsoluteIndex > -1 ? valueFormatter.format(<number>categorical.values[measureAbsoluteIndex].values[i], dataViews[0].categorical.values.grouped()[0].values[measureAbsoluteIndex].source.format) : null;
            var measureDev = [];
            var measureDevForm = [];

            for (var j = measureDeviationStartIndex; j < categorical.values.length && j !== -1; j++) {
                measureDev.push(measureDeviationStartIndex > -1 ? <number>categorical.values[j].values[i] : null);
                measureDevForm.push(measureDeviationStartIndex > -1 ? valueFormatter.format(<number>categorical.values[j].values[i], dataViews[0].categorical.values.grouped()[0].values[j].source.format) : null);
            }

            visualDataPoints.push({
                categoryText: <string>category.values[i],
                measureAbsolute: measureAbs,
                measureDeviation: measureDev,
                measureAbsoluteFormatted: measureAbsForm,
                measureDeviationFormatted: measureDevForm,
            });

            if (i === 0) {
                //Verify that their are not more headers than their are measures given
                countOfMeasures = measureDev.length + ((measureAbs) ? 1 : 0);
            }
        }

        //Removes the extra headers that are left over from the last reading of data
        while (visualSettings.headers.headers.length > countOfMeasures) {
            visualSettings.headers.headers.pop();
        }

        return {
            dataPoints: visualDataPoints,
            settings: visualSettings
        };


    }

    export class Visual implements IVisual {
        private host: IVisualHost;
        private updateCount: number;

        private svg: d3.Selection<SVGElement>;
        private gWidth: number;
        private gHeight: number;

        private visualCurrentSettings: VisualSettings;
        private visualDataPoints: VisualDataPoint[];
        private selectionManager: ISelectionManager;

        private shouldRestartAnimFrame: boolean = false;
        private animationFrameLoopStarted: boolean = false;
        private animationLastTime: any = null;

        private dataView: DataView;
        private rect: d3.Selection<SVGElement>;
        private sText: d3.Selection<SVGElement>;

        private activeSpeed: number = 0;
        private activeFontSize: number = 0;
        private activeTargetSpeed: number = 0;
        private totalTextWidth: number = 1000;
        private viewportWidth: number = 1000;
        private viewportHeight: number = 1000;
        private measure0Index = 0;
        private measure1Index = 1;
        private gPosX: number = 0;

        private arrTextCategories: TextCategory[];

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.selectionManager = options.host.createSelectionManager();
            this.svg = d3.select(options.element).append("svg");
            options.element.style.overflowX = "hidden";

            var that = this;
            this.rect = this.svg.append("rect")
                .on("mouseover", function () {
                    that.activeTargetSpeed = 0;
                })
                .on("mouseout", function () {
                    that.activeTargetSpeed = that.visualCurrentSettings.scroller.pSpeed;
                });

            this.sText = this.svg.append("text");
        }


        public update(options: VisualUpdateOptions) {
            this.shouldRestartAnimFrame = true;
            let viewModel: VisualViewModel = visualTransform(options, this.host, this);
            let settings = this.visualCurrentSettings = viewModel.settings;
            this.visualDataPoints = viewModel.dataPoints;

            let width = this.gWidth = options.viewport.width;
            let height = this.gHeight = options.viewport.height;

            if ((this.visualDataPoints.length === 0 && typeof (this.visualCurrentSettings.scroller) === 'undefined') || (this.visualDataPoints.length === 0 && (!this.visualCurrentSettings.scroller.pCustomText || this.visualCurrentSettings.scroller.pCustomText.length === 0))) {
                // if we have no data and no custom text we want to exit.
                this.svg.attr("visibility", "hidden");
                return;
            }

            this.svg.attr("visibility", "visible");

            this.svg
                .attr("width", width)
                .attr("height", height);

            d3.selectAll(".removable").remove();

            var dataViews = options.dataViews;
            if (!dataViews) return;

            this.dataView = options.dataViews[0];
            var that = this;
            this.shouldRestartAnimFrame = true;

            this.activeTargetSpeed = this.visualCurrentSettings.scroller.pSpeed;

            if (width < 0)
                width = 0;
            if (height < 0)
                height = 0;

            this.viewportWidth = width;
            this.viewportHeight = height;

            if (this.visualCurrentSettings.scroller.pShouldAutoSizeFont) {
                //Since there can be three levels, make the font size a third of the total screen height
                this.activeFontSize = height * 0.3;
            }
            else {
                this.activeFontSize = this.visualCurrentSettings.scroller.pFontSize;
            }
            if (this.activeFontSize < 0) {
                this.activeFontSize = 0;
            }
            else if (this.activeFontSize > 10000) {
                this.activeFontSize = 10000;
            }

            this.rect
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", width)
                .attr("height", height)
                .attr("fill", this.visualCurrentSettings.scroller.pBgColor.solid.color)
                ;

            this.sText.remove();
            this.sText = this.svg.append("text")
                .on("mouseover", function () {
                    that.activeTargetSpeed = 0;
                })
                .on("mouseout", function () {
                    that.activeTargetSpeed = that.visualCurrentSettings.scroller.pSpeed;
                });

            this.sText
                .attr("y", height * 0.5 + this.activeFontSize * 0.30)
                .attr("font-family", "Lucida Console")
                .attr("font-size", this.activeFontSize + "px")
                .attr("fill", "#ffffff")
                ;

            // Create text from data
            this.CreateTextFromData(viewModel, options.dataViews[0]);

            this.sText.each(function () {
                that.totalTextWidth = this.getBBox().width;
            });

            if (!this.animationFrameLoopStarted) {
                this.animationFrameLoopStarted = true;
                this.animationStep();
            }
        }

        /**This is the method that is used to create the text from the already formatted data. This
         * is where we will format the data and not retrieve it.
         */
        private CreateTextFromData(viewModel: VisualViewModel, dataView: DataView) {
            if (this.gPosX === 0) {
                this.gPosX = this.viewportWidth;
            }

            if (this.arrTextCategories != null && this.arrTextCategories.length > 0) {
                for (var i = 0; i < this.arrTextCategories.length; i++) {
                    if (this.arrTextCategories[i].svgSel != null) {
                        this.arrTextCategories[i].svgSel.remove();
                        this.arrTextCategories[i].svgSel = null;
                    }
                }
                this.arrTextCategories.splice(0, this.arrTextCategories.length);
            }

            this.arrTextCategories = [];

            var sText = this.visualCurrentSettings.scroller.pCustomText;
            if (sText && sText.length > 0) {
                // We have a custom text.               
                var newCat: TextCategory = {
                    txtCategory: sText,
                    txtDataAbsoluteFormatted: "",
                    txtDataRelativeFormatted: "",
                    txtSeparator: "",
                    txtSplitChar: [],
                    colStatus: [this.visualCurrentSettings.scroller.pBgColor.solid.color],
                    colText: this.visualCurrentSettings.scroller.pForeColor.solid.color,
                    posX: this.viewportWidth + 10,
                    svgSel: null,
                    sCategory: null,
                    sDataAbsoluteFormatted: null,
                    sDataRelativeFormatted: null,
                    sSeparator: null,
                    sSplitChar: null,
                    actualWidth: 0,
                    offset: 0,
                    categorySize: 0,
                    sHeaders: null,
                    headerOffsets: [],
                    headerSizes: [],
                    statusSize: 0,
                    firstAbsoluteValue: null,
                    centeredLines: []
                };
                newCat.posX = this.gPosX;
                this.arrTextCategories.push(newCat);
                return;
            }

            //This is the part of the code that will create the text based on the values of the data
            for (var i = 0; i < viewModel.dataPoints.length; i++) {
                var category = viewModel.dataPoints[i].categoryText || "Null";

                var bShouldRenderAbsolute = viewModel.dataPoints[i].measureAbsolute === null ? false : true;
                var bShouldRenderRelative = viewModel.dataPoints[i].measureDeviation === null ? false : true;

                var dataAbsolute, dataAbsoluteFormatted, dataRelative, dataRelativeFormatted;

                if (bShouldRenderAbsolute) {
                    dataAbsolute = viewModel.dataPoints[i].measureAbsolute;
                    dataAbsoluteFormatted = viewModel.dataPoints[i].measureAbsoluteFormatted;
                }

                if (bShouldRenderRelative) {
                    dataRelative = viewModel.dataPoints[i].measureDeviation;
                    dataRelativeFormatted = viewModel.dataPoints[i].measureDeviationFormatted;
                }

                // Status Color
                var colorStatus = [];
                var colorText = this.visualCurrentSettings.scroller.pForeColor.solid.color;
                var splitChar = [];

                /**
                 * This for-loop will determine and set the colour and symbol for each measure within the 
                 * deviation.
                 */
                for (var j = 0; j < viewModel.dataPoints[i].measureDeviation.length; j++) {
                    if (bShouldRenderRelative) {
                        //Part of the code that determines if they outcome should be positive or negative
                        if (this.isPositiveValue(dataRelative[j], viewModel.settings, j)) {
                            if (this.visualCurrentSettings.scroller.pShouldUsePosNegColoring) {
                                colorStatus.push(this.visualCurrentSettings.scroller.positiveColour.solid.color);
                            } else {
                                colorStatus.push(this.visualCurrentSettings.scroller.pForeColor.solid.color);
                            }

                            if (this.visualCurrentSettings.scroller.pShouldIndicatePosNeg) {
                                splitChar.push(" ▲ ");
                            } else {
                                splitChar.push(" ")
                            }
                        }
                        else {
                            if (this.visualCurrentSettings.scroller.pShouldUsePosNegColoring) {
                                colorStatus.push(this.visualCurrentSettings.scroller.negativeColour.solid.color);
                            } else {
                                colorStatus.push(this.visualCurrentSettings.scroller.pForeColor.solid.color);
                            }

                            if (this.visualCurrentSettings.scroller.pShouldIndicatePosNeg) {
                                splitChar.push(" ▼ ");
                            } else {
                                splitChar.push(" ")
                            }
                        }
                    }
                }

                var newCat: TextCategory = {
                    txtCategory: category,
                    txtDataAbsoluteFormatted: dataAbsoluteFormatted,
                    txtDataRelativeFormatted: dataRelativeFormatted,
                    txtSeparator: ".....",
                    txtSplitChar: splitChar,
                    colStatus: colorStatus,
                    colText: colorText,
                    posX: this.viewportWidth + 10,
                    svgSel: null,
                    sCategory: null,
                    sDataAbsoluteFormatted: null,
                    sDataRelativeFormatted: null,
                    sSeparator: null,
                    sSplitChar: null,
                    actualWidth: 0,
                    offset: 0,
                    categorySize: 0,
                    sHeaders: null,
                    headerOffsets: [],
                    headerSizes: [],
                    statusSize: 0,
                    firstAbsoluteValue: null,
                    centeredLines: []
                };

                if (i === 0) {
                    newCat.posX = this.gPosX;
                }

                this.arrTextCategories.push(newCat);
            }
        }

        public getMetaDataColumn(dataView: DataView) {
            var retValue = null;
            if (dataView && dataView.metadata && dataView.metadata.columns) {
                for (var i = 0, ilen = dataView.metadata.columns.length; i < ilen; i++) {
                    var column = dataView.metadata.columns[i];
                    if (column.isMeasure) {
                        retValue = column;
                        if ((<any>column.roles).Values === true) {
                            break;
                        }
                    }
                }
            }
            return retValue;
        }

        private isPositiveValue(data, settings, index) {
            if (settings.determinePositive.custom[index].use === false)
                return data >= 0;

            var condition = this.combineConditionAndValue(settings.determinePositive.custom[index].when, settings.determinePositive.custom[index].value);

            if (condition !== undefined) {
                var func = new Function("x", "return x " + condition);
                return func(data);
            }

            return data >= 0;
        }

        //Helper function that will simply combine the values of the when and value of the custom postivie format.
        //If either aren't defined, then undefined is returned
        private combineConditionAndValue(condition, value) {
            if (condition === undefined || value === undefined || value.trim().length === 0) {
                return undefined;
            }

            return " " + condition + " " + value;
        }


        public getMetaDataColumnForMeasureIndex(dataView: DataView, measureIndex: number) {
            var addCol = 0;

            if (dataView && dataView.metadata && dataView.metadata.columns) {
                for (var i = 0; i < dataView.metadata.columns.length; i++) {
                    if (!dataView.metadata.columns[i].isMeasure)
                        addCol++;
                }

                var column = dataView.metadata.columns[measureIndex + addCol];
                if (column.isMeasure) {
                    return column;
                }
            }
            return null;
        }

        // Right settings panel
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];

            switch (objectName) {
                case 'scroller':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "General Scroller",
                        properties: {
                            pSpeed: this.visualCurrentSettings.scroller.pSpeed,
                            pInterval: this.visualCurrentSettings.scroller.pInterval
                        },
                        selector: null
                    });
                    break;
                case 'determinePositive':
                    var properties = {};

                    if (this.visualDataPoints[0] !== undefined && this.visualDataPoints[0].measureDeviation.length === 2) {
                        properties = {
                            custom: this.visualCurrentSettings.determinePositive.custom[0].use,
                            when: this.visualCurrentSettings.determinePositive.custom[0].when,
                            value: this.visualCurrentSettings.determinePositive.custom[0].value,
                            custom2: this.visualCurrentSettings.determinePositive.custom[1].use,
                            when2: this.visualCurrentSettings.determinePositive.custom[1].when,
                            value2: this.visualCurrentSettings.determinePositive.custom[1].value,
                        };
                    } else {
                        properties = {
                            custom: this.visualCurrentSettings.determinePositive.custom[0].use,
                            when: this.visualCurrentSettings.determinePositive.custom[0].when,
                            value: this.visualCurrentSettings.determinePositive.custom[0].value
                        };
                    }

                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Determine Positive",
                        properties: properties,
                        selector: null
                    });
                    break;
                case 'status':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Status",
                        properties: {
                            pShouldIndicatePosNeg: this.visualCurrentSettings.scroller.pShouldIndicatePosNeg,
                            pShouldUsePosNegColoring: this.visualCurrentSettings.scroller.pShouldUsePosNegColoring,
                            pShouldUseTextColoring: this.visualCurrentSettings.scroller.pShouldUseTextColoring,
                        },
                        selector: null
                    });
                    break;
                case 'text':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Text",
                        properties: {
                            pShouldAutoSizeFont: this.visualCurrentSettings.scroller.pShouldAutoSizeFont,
                            pFontSize: this.visualCurrentSettings.scroller.pFontSize,
                            pCustomText: this.visualCurrentSettings.scroller.pCustomText,
                        },
                        selector: null
                    });
                    break;
                case 'colour':
                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Colour",
                        properties: {
                            pForeColor: this.visualCurrentSettings.scroller.pForeColor,
                            pBgColor: this.visualCurrentSettings.scroller.pBgColor,
                            positiveColour: this.visualCurrentSettings.scroller.positiveColour,
                            negativeColour: this.visualCurrentSettings.scroller.negativeColour
                        },
                        selector: null
                    });
                    break;
                case 'headers':
                    var propertiesHeaders = {
                    };

                    if (this.visualDataPoints[0] !== undefined) {
                        var count = this.visualDataPoints[0].measureDeviation.length;
                        count += (this.visualDataPoints[0].measureAbsolute) ? 1 : 0;

                        for (var i = 1; i <= count; i++) {
                            propertiesHeaders["header" + i] = this.visualCurrentSettings.headers.headers[i - 1];
                        }
                    }

                    objectEnumeration.push({
                        objectName: objectName,
                        displayName: "Headers",
                        properties: propertiesHeaders,
                        selector: null
                    });
                    break;
            };

            return objectEnumeration;
        }

        public destroy(): void {
            window["cancelAnimFrame"](this.animationId);//removes animation callback.
        }

        public animationFrameLoopExited() {
            if (this.shouldRestartAnimFrame) {
                this.shouldRestartAnimFrame = false;
                this.animationStep();
            }
        }

        private animationId: number = 0;//add a new property to keep id of animation callback.

        public animationStep() {
            if (this.shouldRestartAnimFrame) {
                this.animationFrameLoopExited();
                return;
            }
            var that = this;
            //keep id of animation callback to animationId.
            this.animationId = window["requestAnimFrame"](function () { that.animationStep(); });

            this.animationUpdateStep();
        }

        public animationUpdateStep() {
            if (!this.arrTextCategories) {
                return;
            }

            var now = new Date().getTime(), dt = now - (this.animationLastTime || now);
            this.animationLastTime = now;

            var curSettings = this.visualCurrentSettings;

            var pIntervalStatic = dt * 1.2; // this.pInterval_get(this.dataView)
            debugger;
            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];
                if (s.svgSel == null) {
                    // Create element (it's within the viewport) 
                    if (s.posX < this.viewportWidth) {
                        var bShouldRenderAbsolute = false;
                        var bShouldRenderRelative = false;

                        if (this.visualDataPoints.length > 0) {
                            bShouldRenderAbsolute = (this.visualDataPoints[0].measureAbsolute) ? true : false;
                            bShouldRenderRelative = this.visualDataPoints[0].measureDeviation.length > 0 ? true : false;
                        }

                        var y = this.viewportHeight * 0.5 + 3 * (this.activeFontSize * 0.4);


                        s.svgSel = this.svg.append("text").attr("x", s.posX);
                        s.svgSel.attr("font-family", "Lucida Console").attr("font-size", this.activeFontSize + "px");

                        d3.selectAll("." + s.txtCategory).remove();
                        s.centeredLines[0] = this.svg.append("line").classed("removable", true).classed(s.txtCategory, true);
                        s.centeredLines[1] = this.svg.append("line").classed("removable", true).classed(s.txtCategory, true);


                        var that = this;
                        s.svgSel
                            .on("mouseover", function () {
                                that.activeTargetSpeed = 0;
                            })
                            .on("mouseout", function () {
                                that.activeTargetSpeed = curSettings.scroller == null ? 0 : curSettings.scroller.pSpeed;
                            });

                        s.sCategory = s.svgSel.append("tspan")
                            .text(s.txtCategory)
                            .attr("y", y)
                            .style("fill", s.colText)
                            ;

                        //Get the size of the category that will be used to center it 
                        s.svgSel.each(function () {
                            s.categorySize = this.getBBox().width;
                        });

                        var headers = this.visualCurrentSettings.headers.headers;
                        s.sHeaders = [];
                        s.headerSizes = [];

                        for (var j = 0; j < headers.length; j++) {
                            //Retrieve the current size of the text element before we append the next header (used to get header size)
                            s.svgSel.each(function () {
                                s.offset = this.getBBox().width;
                            });

                            s.sHeaders.push(s.svgSel.append("tspan")
                                .text("" + headers[j])
                                .attr("y", y)
                                .style("fill", s.colText)
                            );

                            //Using the offset we calculate the size of the header that was just appended
                            s.svgSel.each(function () {
                                s.headerSizes.push(this.getBBox().width - s.offset);
                            });
                        }

                        //Get the current size of the text (to be removed from total height)
                        s.svgSel.each(function () {
                            s.offset = this.getBBox().width;
                        });

                        //We need to calculate the offsets used for the headers in order for them to be centered above their values
                        var offsetForHeaders = s.offset;
                        s.headerOffsets = [];

                        if (bShouldRenderAbsolute) {
                            s.sDataAbsoluteFormatted = s.svgSel.append("tspan")
                                .text(s.txtDataAbsoluteFormatted)
                                .attr("y", y)
                                .style("fill", s.colText)
                                ;

                            //Get the offset for the first header (being the absolute data)
                            s.svgSel.each(function () {
                                s.headerOffsets.push(this.getBBox().width - offsetForHeaders);
                                offsetForHeaders = this.getBBox().width;
                            });
                        }

                        if (bShouldRenderRelative) {
                            for (var j = 0; j < s.txtDataRelativeFormatted.length; j++) {
                                var temp = s.svgSel.append("tspan")
                                    .text(s.txtSplitChar[j])
                                    .attr("y", y)
                                    .style("fill", s.colStatus[j])
                                    ;

                                if (j === 0) {
                                    s.firstAbsoluteValue = temp;
                                }

                                //Retrieves the size of the the triangle (status + or -)
                                s.svgSel.each(function () {
                                    s.statusSize = this.getBBox().width - offsetForHeaders;
                                });

                                var colText = s.colText;

                                if (curSettings.scroller.pShouldUseTextColoring) {
                                    colText = s.colStatus[j];
                                }

                                s.svgSel.append("tspan")
                                    .text(s.txtDataRelativeFormatted[j])
                                    .attr("y", y)
                                    .style("fill", colText)
                                    ;

                                s.svgSel.each(function () {
                                    s.headerOffsets.push(this.getBBox().width - offsetForHeaders - s.statusSize);
                                    offsetForHeaders = this.getBBox().width;
                                });
                            }
                        }

                        var offsetOfCategoryAndHeaders = s.offset;

                        var widthBeforeSpiltChar;

                        s.svgSel.each(function () {
                            widthBeforeSpiltChar = this.getBBox().width;
                        });

                        s.sSplitChar = s.svgSel.append("tspan")
                            .text(s.txtSeparator)
                            .attr("y", y)
                            .style("fill", function (e) { return curSettings.scroller == null ? "#abcdef" : curSettings.scroller.pBgColor.solid.color; })
                            ;

                        s.svgSel.each(function () {
                            //Don't add the offset if it is the header being displayed
                            var offset = this.getBBox().height;

                            for (var i = 0; i < s.sHeaders.length; i++) {
                                s.sHeaders[i].attr("y", y - offset);
                            }

                            //Keep track of the category height and y position to use it to place the lines
                            var categoryHeight = y - this.getBBox().height;
                            offset = this.getBBox().height;
                            s.sCategory.attr("y", categoryHeight);

                            var temp = this.getBBox().height;
                            var yLines = categoryHeight - ((temp - offset) * 0.4);
                            s.centeredLines[0].attr("y1", yLines).attr("y2", yLines);
                            s.centeredLines[1].attr("y1", yLines).attr("y2", yLines);

                            //The actual width of the element will be the largest element between the different levels
                            s.actualWidth = d3.max([widthBeforeSpiltChar - offsetOfCategoryAndHeaders,
                            s.categorySize
                            ]);

                            //Use s.offset to get the size of the split char in order to take it into consideration for the centering
                            s.offset = this.getBBox().width - widthBeforeSpiltChar;
                        });

                        if (i > 0) {
                            var sPrev: TextCategory = this.arrTextCategories[i - 1];
                            s.posX = sPrev.posX + sPrev.actualWidth;
                        }

                        // Nedanstående är till för att hantera om vi har mindre texter än hela utrymmet - då vill vi inte lägga in textern i mitten...
                        if (s.posX < this.viewportWidth) {
                            s.posX = this.viewportWidth;
                        }

                        // Uppdatera alla efterliggande med den nyligen tillagdas position och bredd.
                        if (i < this.arrTextCategories.length - 1) {
                            for (var t = i + 1; t < this.arrTextCategories.length; t++) {
                                var sNext: TextCategory = this.arrTextCategories[t];
                                sNext.posX = s.posX + s.actualWidth + s.offset;
                            }
                        }
                    }
                }
            }

            this.activeSpeed += (this.activeTargetSpeed - this.activeSpeed) * 0.5;
            if (this.activeSpeed < 0) {
                this.activeSpeed = 0;
            }
            if (this.activeSpeed > 100) {
                this.activeSpeed = 100;
            }

            this.gPosX -= this.activeSpeed * 8 * pIntervalStatic / 100;
            if (this.gPosX < -5000) {
                this.gPosX = 0;
            }

            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];
                s.posX -= this.activeSpeed * 8 * pIntervalStatic / 100;
                if (s.svgSel != null) {
                    s.svgSel.attr("x", s.posX);


                    //If the size of the element is the same as the category then we don't need lines to fill the empty space
                    //Since there will not be any empty spaces left
                    if (s.actualWidth !== s.categorySize) {
                        //Calculate the width of the element without the spacing
                        var actualWidth = s.actualWidth;

                        //Center the category
                        s.sCategory.attr("x", s.posX + (actualWidth - s.categorySize) / 2);

                        var offSetForCategory = 8;

                        //Fill up the space next to the category with lines
                        s.centeredLines[0].attr("x1", s.posX).attr("x2", s.posX + ((actualWidth - s.categorySize) / 2) - offSetForCategory).attr("stroke-width", this.activeFontSize / 10).attr("stroke", this.visualCurrentSettings.scroller.pForeColor.solid.color);
                        s.centeredLines[1].attr("x1", s.posX + ((actualWidth + s.categorySize) / 2) + offSetForCategory).attr("x2", s.posX + actualWidth).attr("stroke-width", this.activeFontSize / 10).attr("stroke", this.visualCurrentSettings.scroller.pForeColor.solid.color);
                    }

                    var posX = s.posX;
                    //If the category is the largest part, then we need to center the stocks information based on that
                    if (s.actualWidth === s.categorySize) {
                        posX += s.categorySize / 2;

                        //Takes into consideration the size of the headers
                        for (var j = 0; j < s.headerOffsets.length; j++) {
                            posX -= s.headerOffsets[j] / 2;
                        }

                        //Takes into consideration the size of the icons (triangles for positive or negative)
                        if (s.txtDataRelativeFormatted !== null) {
                            for (var j = 0; j < s.txtDataRelativeFormatted.length; j++) {
                                posX -= s.statusSize / 2;
                            }
                        }
                    }

                    //Move the absolute data to the start of the box (taking the place of the category)
                    if (s.sDataAbsoluteFormatted !== null) {
                        s.sDataAbsoluteFormatted.attr("x", posX);
                    } else if (s.firstAbsoluteValue !== null) {
                        s.firstAbsoluteValue.attr("x", posX);
                    }

                    //Loop through all of the headers to add the appropriate offset to them in order for them to be centered on top of their values
                    if (s.headerOffsets !== null) {
                        var headerSize = 0;

                        //If the first information is not the absolute data, then we need to take into consideration the status size
                        if (s.sDataAbsoluteFormatted === null)
                            headerSize = s.statusSize;

                        if (s.sHeaders !== null) {
                            for (var j = 0; j < s.sHeaders.length; j++) {
                                s.sHeaders[j].attr("x", posX + headerSize + (s.headerOffsets[j] / 2) - (s.headerSizes[j] / 2));

                                //Append the offset of the previous header and the status symbol (triangle) to the total offset
                                headerSize += s.headerOffsets[j] + s.statusSize;
                            }
                        }
                    }
                }
            }


            // Remove elements outside of the left of the viewport
            for (var i = 0; i < this.arrTextCategories.length; i++) {
                var s: TextCategory = this.arrTextCategories[i];

                if ((s.posX + s.actualWidth) < 0) {
                    // Hela elementet är utanför, ta bort det (börja om)
                    var r1: TextCategory = this.arrTextCategories.splice(i, 1)[0];
                    if (r1.svgSel != null) {
                        r1.svgSel.remove();
                    }
                    r1.svgSel = null;
                    r1.actualWidth = 0;

                    r1.posX = 0;
                    if (this.arrTextCategories.length > 0) {
                        var sLast: TextCategory = this.arrTextCategories[this.arrTextCategories.length - 1];
                        r1.posX = sLast.posX + 10;
                    }
                    else {
                        r1.posX = this.viewportWidth;
                    }
                    if (r1.posX < this.viewportWidth) {
                        r1.posX = this.viewportWidth;
                    }

                    this.arrTextCategories.push(r1);

                    break;
                }
            }
        }

    }
}
