
define(['d3', 'sprintf', 'base64js', 'pako_inflate'], function(d3, sprintf, base64, pako) {
    var sprintf = sprintf.sprintf;

    var io = function() {
        var _this = this;
        this._base_url = "http://127.0.0.1:8000/data";
        this._server_url = "ws://127.0.0.1:8001";

        this.data_handlers = {};

        this.init_io = function() {
            _this._ws = new WebSocket(this._server_url);

            _this._ws.onopen = function(event) {

            };

            _this._ws.onmessage = function(event) {
                msg_json = JSON.parse(event.data);
                msg_json.data = _this.decompress(msg_json.data);
                handler = msg_json.handler;
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
            _this._ws.send(JSON.stringify(msg_json));
        };

        this.download_level2 = function(site, time, field, elevation, cb) {
            var time_fmt = d3.timeFormat("%Y%m%d_%H%M");
            var time_str = time_fmt(time);
            var url = sprintf("/l2/%s_%s_%04.1f_%s.json", site, field, elevation, time_str);
            this._fetch_url(url, function(l2_file) {
                cb(l2_file);
            });
        };

        this.download_88d_list = function(cb) {
            d3.json(sprintf("%s/wsr88ds.json", _this._base_url)).get(cb);
        };

        this.download_shape = function(url, cb) {
            this._fetch_url(url, function(shp_file) {
                cb(shp_file);
            });
        };

        this._fetch_url = function(url, cb) {
            var full_url = sprintf("%s%s", _this._base_url, url);
            d3.json(full_url).get(function(df) {
                df.data = _this.decompress(df.data);
                cb(df);
            })
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
