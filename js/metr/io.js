
define(['d3', 'sprintf', 'base64js', 'pako_inflate'], function(d3, sprintf, base64, pako) {
    var sprintf = sprintf.sprintf;
    var _mod = this;

    var io = function() {
        var _this = this;
        this._base_url = "http://127.0.0.1:8000/data";
        this._server_url = "ws://127.0.0.1:8001";

        this.data_handlers = {};
        this._early_requests = [];

        this.init_io = function() {
            _this._ws = new WebSocket(this._server_url);

            _this._ws.onopen = function(event) {
                _this.request = function(msg_json) {
                    _this._ws.send(JSON.stringify(msg_json));
                };

                for (var ireq in _this._early_requests) {
                    _this.request(_this._early_requests[ireq]);
                }
            };

            _this._ws.onmessage = function(event) {
                function handler(msg_json) {
                    var handler = msg_json.handler;
                    var dt = d3.timeFormat("%d %b %Y %H:%M:%S")(new Date());
                    console.log(dt + ': Receiving data for ' + handler);
                    _this.data_handlers[handler](msg_json);
                }

                try {
                    // Try assuming the old format first
                    var msg_json = JSON.parse(event.data);
                    if (msg_json.data !== undefined) {
                        // Would be missing in the event of an error
                        msg_json.data = _this.decompress(msg_json.data);
                    }
                    handler(msg_json);
                }
                catch (exc) {
                    // If the JSON parsing fails, it must be the new format, which is compressed JSON
                    var file_reader = new FileReader();
                    file_reader.onload = function(event) {
                        var parser = d3.utcParse("%Y-%m-%d %H:%M:%S UTC");

                        var infl_ba = pako.inflate(event.target.result);
                        var msg_text = _this.ba_to_str(infl_ba);
                        var msg_json = JSON.parse(msg_text);
                        if (msg_json.entities !== undefined) {
                            for (var ient = 0; ient < msg_json.entities.length; ient++) {
                                msg_json.entities[ient].valid = parser(msg_json.entities[ient].valid);
                                msg_json.entities[ient].expires = parser(msg_json.entities[ient].expires);

                                if (msg_json.entities[ient].shape !== undefined) {
                                    var raw_ba = base64.toByteArray(msg_json.entities[ient].shape.coordinates);
                                    var line_array = new Float32Array(raw_ba.buffer);

                                    var line = [];
                                    for (var icd = 0; icd < line_array.length; icd++) {
                                        if (isNaN(line_array[icd])) {
                                        line.push(NaN, NaN);
                                        }
                                        else {
                                            line.push(line_array[icd]);
                                        }
                                    }
                                    msg_json.entities[ient].shape.coordinates = line;
                                }
                                else if (msg_json.entities[ient].data !== undefined) {
                                    msg_json.entities[ient].data = base64.toByteArray(msg_json.entities[ient].data);
                                }
                            }
                        }
                        handler(msg_json);
                    };
                    file_reader.readAsArrayBuffer(event.data);
                }
            };
        };

        this.register_handler = function(name, cb) {
            _this.data_handlers[name] = cb;
        };

        this.unregister_handler = function(name) {
            delete _this.data_handlers[name];
        };

        this.request = function(msg_json) {
            _this._early_requests.push(msg_json);
        };

        this.decompress = function(data) {
            var compr_ba = base64.toByteArray(data);
            var infl_ba = pako.inflate(compr_ba);
            var decomp_data = new Float32Array(infl_ba.buffer);
            return decomp_data
        };

        this.ba_to_str = function (arr) {
            var strings = [];
            var chunksize = 0xffff;

            // There is a maximum stack size. We cannot call String.fromCharCode with as many arguments as we want
            for (var i=0; i*chunksize < arr.length; i++){
                strings.push(String.fromCharCode.apply(null, arr.subarray(i*chunksize, (i+1)*chunksize)));
            }
            return strings.join('');
        };

        _this.init_io();
    };

    return new io()
});
