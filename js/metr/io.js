
define(['d3', 'sprintf', 'base64js', 'pako_inflate'], function(d3, sprintf, base64, pako) {
    var sprintf = sprintf.sprintf;

    var io = function() {
        var _this = this;
        this._base_url = "http://127.0.0.1:8000/data";

        this.download_level2 = function(site, time, field, elevation, cb) {
            var time_str = sprintf("%04d%02d%02d_%02d%02d", time.getFullYear(), time.getMonth(), time.getDate(), 
                                   time.getHours(), time.getMinutes());
            var url = sprintf("/l2/%s_%s_%04.1f_%s.json", site, field, elevation, time_str);
            this._fetch_url(url, function(l2_file) {
/*
                l2_file._data = l2_file.data
                l2_file.data = function(iaz, igt) {
                    var idx = l2_file.n_gates * iaz + igt;
                    return l2_file._data[idx]
                }
*/
                cb(l2_file);
            });
        };

        this.download_88d_list = function(cb) {
            d3.json(sprintf("%s/wsr88ds.json", _this._base_url)).get(cb);
        };

        this.download_shape = function(url, cb) {
            this._fetch_url(url, function(shp_file) {
                var shp_data = shp_file.data;
                shp_file.data = [[]];

                var slc_start = 0;
                var nshp = 0;
                for (var i = 0; i < shp_data.length; i++) {
                    if (isNaN(shp_data[i])) {
                        slc_start = i + 1;
                        nshp++;
                        shp_file.data[nshp] = [];
                    }
                    else {
                        shp_file.data[nshp][i - slc_start] = shp_data[i];
                    }
                }
                for (var i = 0; i < shp_file.data.length; i++) {
                    shp = shp_file.data[i];
                    shp_file.data[i] = [];

                    for (var j = 0; j < shp.length; j += 2) {
                        shp_file.data[i][j / 2] = [shp[j], shp[j + 1]];
                    }
                }
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

    };
    return new io()
});
