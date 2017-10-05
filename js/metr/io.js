
define(['d3', 'sprintf', 'base64js', 'pako_inflate'], function(d3, sprintf, base64, pako) {
    var sprintf = sprintf.sprintf;

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
                var msg_json = JSON.parse(event.data);
                msg_json.data = _this.decompress(msg_json.data);
                var handler = msg_json.handler;
                var dt = d3.timeFormat("%d %b %Y %H:%M:%S")(new Date());
                console.log(dt + ': Receiving data for ' + handler);
                _this.data_handlers[handler](msg_json);
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
            compr_ba = base64.toByteArray(data);
            infl_ba = pako.inflate(compr_ba);
            decomp_data = new Float32Array(infl_ba.buffer);
            return decomp_data
        };

        _this.init_io();
    };
    return new io()
});
