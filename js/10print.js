

(function() {
    var lastTime, vendors, x;

    lastTime = 0;
    vendors = ['ms', 'moz', 'webkit', 'o'];
    for(x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] ||
            window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback) {
            var currTime, timeToCall, id;

            currTime = new Date().getTime();
            timeToCall = Math.max(0, 16 - (currTime - lastTime));
            id = window.setTimeout(function() { callback(currTime + timeToCall); },
                                   timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

function Overscan () {
    this.initialize.apply(this, arguments);
}
Overscan.TOP = 0;
Overscan.RIGHT = 1;
Overscan.BOTTOM = 2;
Overscan.LEFT = 3;
Overscan.TOP_RIGHT = 4;
Overscan.BOTTOM_RIGHT = 5;
(function (proto) {
    proto.initialize = function (width, height) {
        this.width = width;
        this.height = height;
        this.fills = {};
        this.fillCount = 0;
    };

    proto.getFill = function (key) {
        var fill;
        var itemCount, index;

        fill = this.fills[key];
        if (!fill) {
            if (key % 2) {
                itemCount = this.width * 2 + 4;
            } else {
                itemCount = this.height * 2;
            }
            fill = {
                fill: [],
                refCount: 0
            };
            for (index = 0; index < itemCount; index++) {
                fill.fill.push(Math.random());
            }
            this.fills[key] = fill;
            this.fillCount += 1;
        }
        fill.refCount += 1;
        return fill.fill;
    };

    proto.getKey = function (keyPair, direction) {
        var key;
        var axisSep;
        var spanSep;

        axisSep = "x";
        spanSep = ":";

        if (direction === Overscan.TOP) {
            key = "" + keyPair.u + axisSep + keyPair.v + spanSep + (keyPair.v + 1);
        } else if (direction === Overscan.RIGHT) {
            key = "" + (keyPair.u + 1) + spanSep + (keyPair.u + 2) + axisSep + keyPair.v;
        } else if (direction === Overscan.BOTTOM) {
            key = "" + keyPair.u + axisSep + (keyPair.v + 1) + spanSep + (keyPair.v + 2);
        } else if (direction === Overscan.LEFT) {
            key = "" + keyPair.u + spanSep + (keyPair.u + 1) + axisSep + keyPair.v;
        } else if (direction === Overscan.TOP_RIGHT) {
            key = "" + (keyPair.u + 1) + axisSep + keyPair.v + spanSep + (keyPair.v + 1);
        } else if (direction === Overscan.BOTTOM_RIGHT) {
            key = "" + (keyPair.u + 1) + axisSep + (keyPair.v + 1) + spanSep + (keyPair.v + 2);
        }

        return key;
    };

    proto.getFills = function (keyPair) {
        var fills;

        fills = {
            0: this.getFill(this.getKey(keyPair, Overscan.TOP)),
            1: this.getFill(this.getKey(keyPair, Overscan.RIGHT)),
            2: this.getFill(this.getKey(keyPair, Overscan.BOTTOM)),
            3: this.getFill(this.getKey(keyPair, Overscan.LEFT)),
            4: this.getFill(this.getKey(keyPair, Overscan.TOP_RIGHT)),
            5: this.getFill(this.getKey(keyPair, Overscan.BOTTOM_RIGHT))
        };

        return fills;
    };

    proto.release = function (keyPair) {
        var keys, key, index;
        var fill;

        keys = [
            this.getKey(keyPair, Overscan.TOP),
            this.getKey(keyPair, Overscan.RIGHT),
            this.getKey(keyPair, Overscan.BOTTOM),
            this.getKey(keyPair, Overscan.LEFT),
            this.getKey(keyPair, Overscan.TOP_RIGHT),
            this.getKey(keyPair, Overscan.BOTTOM_RIGHT)
        ];

        for (index = 0; index < keys.length; index++) {
            key = keys[index];
            fill = this.fills[key];
            fill.refCount -= 1;
            if (fill.refCount === 0) {
                delete this.fills[key];
                this.fillCount -= 1;
            }
        }
    };
}(Overscan.prototype));

function place(direction, context, dims, x, y, callback) {
    context.save();

    if (typeof direction === "undefined") {
        throw "undefined direction.";
    }
    if (direction > 0.5) {
        direction = 1;
    } else {
        direction = -1;
    }

    if (direction < 0) {
        x += dims.width;
    }

    context.translate(x, y);
    context.scale(dims.width * direction, dims.height);

    callback(dims, context);
    context.fill();

    context.restore();
}

function c64LinePath (dims, context) {
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(dims.thickness, 0);
    context.lineTo(1, 1 - dims.thickness);
    context.lineTo(1, 1);
    context.lineTo(1 - dims.thickness, 1);
    context.lineTo(0, dims.thickness);
    context.closePath();
}

function Panel () {
    this.initialize.apply(this, arguments);
}
(function (proto) {
    var createCanvas = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.setAttribute('width', width);
        canvas.setAttribute('height', height);
        return canvas;
    };

    proto.initialize = function (u, v, width, height) {
        this.overscanSize = 4;
        this.u = u;
        this.v = v;
        this.x = u * width;
        this.y = v * height;
        this.width = width;
        this.height = height;
        this.canvas = createCanvas(width + this.overscanSize * 2,
                                   height + this.overscanSize * 2);
    };

    proto.getContext = function () {
        if (!this.context) {
            this.context = this.canvas.getContext('2d');
        }
        return this.context;
    };

    proto.fill = function (dims, overscan, method) {
        var x, y, direction;
        var panelSizeX, panelSizeY;
        var context;

        context = this.getContext();
        context.fillStyle = dims.color;
        method = method || c64LinePath;

        panelSizeX = this.width / dims.width;
        panelSizeY = this.height / dims.height;
        for (x = 1; x < panelSizeX - 1; x++) {
            for (y = 1; y < panelSizeY - 1; y++) {
                direction = Math.random();
                place(direction, context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }

        this.fillOverscan(dims, overscan, method);
    };

    proto.fillOverscan = function (dims, overscan, method) {
        var DEBUG = false;

        var x, y, index;
        var context;
        var panelSizeX, panelSizeY;
        var fills;
        var startX, startY;
        var endX, endY;
        var region;

        context = this.getContext();
        context.fillStyle = dims.color;
        method = method || c64LinePath;

        panelSizeX = this.width / dims.width;
        panelSizeY = this.height / dims.height;
        fills = overscan.getFills(this);

        if (DEBUG) {
            context.fillStyle = "rgba(128,255,0,.5)";
        }
        region = Overscan.TOP;
        startX = -1;
        endX = panelSizeX - 1;
        startY = -1;
        endY = 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) + (y - startY) * (endX - startX);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }

        if (DEBUG) {
            context.fillStyle = "rgba(255,128,0,.5)";
        }
        region = Overscan.RIGHT;
        startX = panelSizeX - 1;
        endX = panelSizeX + 1;
        startY = 1;
        endY = panelSizeY - 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) * (endY - startY) + (y - startY);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }


        if (DEBUG) {
            context.fillStyle = "rgba(255,0,128,.5)";
        }
        region = Overscan.BOTTOM;
        startX = -1;
        endX = panelSizeX - 1;
        startY = panelSizeY - 1;
        endY = panelSizeY + 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) + (y - startY) * (endX - startX);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }

        if (DEBUG) {
            context.fillStyle = "rgba(0,128,255,.5)";
        }
        region = Overscan.LEFT;
        startX = -1;
        endX = 1;
        startY = 1;
        endY = panelSizeY - 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) * (endY - startY) + (y - startY);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }


        if (DEBUG) {
            context.fillStyle = "rgba(128,255,255,.5)";
        }
        region = Overscan.TOP_RIGHT;
        startX = panelSizeX - 1;
        endX = panelSizeX + 1;
        startY = -1;
        endY = 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) + (y - startY) * (panelSizeX);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }

        if (DEBUG) {
            context.fillStyle = "rgba(128,0,255,.5)";
        }
        region = Overscan.BOTTOM_RIGHT;
        startX = panelSizeX - 1;
        endX = panelSizeX + 1;
        startY = panelSizeY - 1;
        endY = panelSizeY + 1;
        for (x = startX; x < endX; x++) {
            for (y = startY; y < endY; y++) {
                index = (x - startX) + (y - startY) * (panelSizeX);
                place(fills[region][index], context, dims,
                      x * dims.width + this.overscanSize, y * dims.height + this.overscanSize,
                      method);
            }
        }
    };

    proto.clear = function () {
        var context;

        context = this.getContext();
        context.clearRect(0, 0,
                          this.width + 2 * this.overscanSize,
                          this.height + 2 * this.overscanSize);
    };

    proto.place = function (context, x, y) {
        context.drawImage(this.canvas,
                          this.overscanSize / 2, this.overscanSize / 2,
                          this.width + this.overscanSize, this.height + this.overscanSize,
                          x - this.overscanSize / 2, y - this.overscanSize / 2,
                          this.width + this.overscanSize, this.height + this.overscanSize);
    };
}(Panel.prototype));

function Print10 () {
    this.initialize.apply(this, arguments);
}
(function (proto) {
    var shouldUpscale = function () {
        var userAgent, androidPattern;
        var match;

        userAgent = window.navigator && window.navigator.userAgent;
        if (!userAgent) {
            return false;
        }
        androidPattern = /Android (\d\.\d\.\d)/;
        match = androidPattern.exec(userAgent);
        if (match) {
            return true;
        }
    };

    var bakeDims = function (dims) {
        dims.thicknessSqrt = Math.sqrt(1 + dims.thickness) - 1;
        if (shouldUpscale()) {
            dims.totalWidth = dims.totalWidth / 2;
            dims.totalHeight = dims.totalHeight / 2;
            dims.width = dims.width / 2;
            dims.height = dims.height / 2;
        }
        return dims;
    };

    var bakeMovement = function(movement) {
        movement.cos.scale = (movement.cos.max - movement.cos.min) / 2;
        movement.cos.offset = (movement.cos.min + movement.cos.max) / 2;
        movement.sin.scale = (movement.sin.max - movement.sin.min) / 2;
        movement.sin.offset = (movement.sin.min + movement.sin.max) / 2;

        return movement;
    };

    proto.initialize = function (dims) {
        this.dims = bakeDims(dims);
        this.buildPanels(c64LinePath);
        this.offset = { x: 0, y: 0, theta: 0 };
        this.movement = bakeMovement({
            x: 0, y: -0.5, theta: 0.01,
            cos: { rate: 0.2, shift: Math.PI, min: -0.5, max: 0.5 },
            sin: { rate: 0.5, shift: 0, min: 0, max: 0.5 }
        });
    };

    proto.showIncompatability = function () {
        var element;
        var style;

        element = document.createElement("P");
        element.innerHTML = "Sorry! Canvas elements aren't supported by your browser.";
        style = [
            "color: " + this.dims.color
        ];
        element.setAttribute("style", style.join("; ") + ";");
        this.container.appendChild(element);
    };

    proto.build = function (container) {
        var figure;

        this.container = container;

        figure = document.createElement('FIGURE');
        figure.setAttribute("class", "print10");
        figure.setAttribute("style", "margin: 0em; width: 100%;");

        this.canvas = document.createElement('CANVAS');
        this.canvas.setAttribute('width', this.dims.totalWidth);
        this.canvas.setAttribute('height', this.dims.totalHeight);
        this.canvas.setAttribute('class', "print10");
        this.canvas.setAttribute("style", "width: 100%; background: " + this.dims.background + ";");
        if (typeof this.canvas.getContext === "undefined") {
            this.isIncompatible = true;
            return;
        }
        figure.appendChild(this.canvas);
        this.container.appendChild(figure);
    };

    proto.start = function () {
        var self = this;
        var timestep;
        if (this.isIncompatible) {
            this.showIncompatability();
            return;
        }

        timestep = function () {
            self.tick();
            window.requestAnimationFrame(timestep);
        };
        timestep();
    };

    proto.buildPanels = function (method) {
        var maxDim = 320;
        var panelSizeX, panelSizeY;
        var panelWidth, panelHeight;
        var uStride, vStride;
        var u, v;
        var panel;

        panelSizeX = Math.floor(maxDim / this.dims.width);
        panelSizeY = Math.floor(maxDim / this.dims.height);
        panelWidth = panelSizeX * this.dims.width;
        panelHeight = panelSizeY * this.dims.height;
        uStride = Math.ceil(this.dims.totalWidth / maxDim) + 1;
        vStride = Math.ceil(this.dims.totalHeight / maxDim) + 1;

        this.overscan = new Overscan(panelSizeX, panelSizeY);
        this.panels = [];
        for (u = 0; u < uStride; u++) {
            for (v = 0; v < vStride; v++) {
                panel = new Panel(u, v, panelWidth, panelHeight);
                panel.fill(this.dims, this.overscan, method);
                this.panels.push(panel);
            }
        }
        this.panelLeap = {
            x: uStride * panelWidth,
            y: vStride * panelHeight,
            u: uStride,
            v: vStride
        };
    };

    proto.tick = function () {
        var xCos, ySin;
        var delta;

        this.offset.theta += this.movement.theta;
        xCos = Math.sin(this.offset.theta * this.movement.cos.rate + this.movement.cos.shift) *
            this.movement.cos.scale + this.movement.cos.offset;
        ySin = Math.sin(this.offset.theta * this.movement.sin.rate + this.movement.sin.shift) *
            this.movement.sin.scale + this.movement.sin.offset;
        delta = {
            x: this.movement.x + xCos,
            y: this.movement.y + ySin
        };

        this.offset.x += delta.x;
        this.offset.y += delta.y;

        this.repositionPanels(delta);
        this.drawPanels();
    };

    proto.needsReposition = function (panel, delta) {
        var needsReposition = { either: false, x: false, y: false };

        if (delta.x < 0 &&
            this.offset.x + panel.x + panel.width < 0) {
            needsReposition.either = true;
            needsReposition.x = true;
        } else if (delta.x > 0 &&
                   this.offset.x + panel.x > this.dims.totalWidth) {
            needsReposition.either = true;
            needsReposition.x = true;
        }

        if (delta.y < 0 &&
            this.offset.y + panel.y + panel.height < 0) {
            needsReposition.either = true;
            needsReposition.y = true;
        } else if (delta.y > 0 &&
                   this.offset.y + panel.y > this.dims.totalHeight) {
            needsReposition.either = true;
            needsReposition.y = true;
        }
        return needsReposition;
    };

    proto.reposition = function (panel, delta, needsReposition) {
        var xDirection, yDirection;

        xDirection = 0;
        if (needsReposition.x && delta.x) {
            xDirection = delta.x > 0 ? -1 : 1;
        }
        yDirection = 0;
        if (needsReposition.y && delta.y) {
            yDirection = delta.y > 0 ? -1 : 1;
        }

        panel.x += this.panelLeap.x * xDirection;
        panel.y += this.panelLeap.y * yDirection;
        panel.u += this.panelLeap.u * xDirection;
        panel.v += this.panelLeap.v * yDirection;
    };

    proto.repositionPanels = function (delta) {
        var index, panel;
        var needsReposition;
        for (index = this.panels.length; index--;) {
            panel = this.panels[index];
            needsReposition = this.needsReposition(panel, delta);
            if (needsReposition.either) {
                this.overscan.release(panel);
                this.reposition(panel, delta, needsReposition);
                panel.clear();
                panel.fill(this.dims, this.overscan);
            }
        }
    };

    proto.drawPanels = function () {
        var index, panel;
        var context;

        context = this.getContext();
        context.clearRect(0, 0, this.dims.totalWidth, this.dims.totalHeight);
        for (index = this.panels.length; index--;) {
            panel = this.panels[index];
            panel.place(context,
                            this.offset.x + panel.x,
                            this.offset.y + panel.y);
        }
    };

    proto.getContext = function () {
        if (!this.context) {
            this.context = this.canvas.getContext('2d');
        }
        return this.context;
    };
}(Print10.prototype));


