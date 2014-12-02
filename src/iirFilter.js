/* global define, Complex, evaluatePhase */
/*jslint bitwise: true */
(function (window) {
  'use strict';

  // params: array of biquad coefficient objects and z registers
  // stage structure e.g. {k:1, a:[1.1, -1.2], b:[0.3, -1.2, -0.4], z:[0, 0]}
  var Filter = function (filter) {
    var f = filter;
    var cone = {
      re: 1,
      im: 0
    };
    var cf = [];
    for (var cnt = 0; cnt < f.length; cnt++) {
      cf[cnt] = {};
      var s = f[cnt];
      cf[cnt].b0 = {
        re: s.b[0],
        im: 0
      };
      cf[cnt].b1 = {
        re: s.b[1],
        im: 0
      };
      cf[cnt].b2 = {
        re: s.b[2],
        im: 0
      };
      cf[cnt].a1 = {
        re: s.a[0],
        im: 0
      };
      cf[cnt].a2 = {
        re: s.a[1],
        im: 0
      };
      cf[cnt].k = {
        re: s.k,
        im: 0
      };
    }
    var complex = new Complex();
    var runStage = function (s, input) {
      var temp = input * s.k - s.a[0] * s.z[0] - s.a[1] * s.z[1];
      var out = s.b[0] * temp + s.b[1] * s.z[0] + s.b[2] * s.z[1];
      s.z[1] = s.z[0];
      s.z[0] = temp;
      return out;
    };

    var runFilter = function (input, coeffs) {
      var out = input;
      var cnt = 0;
      for (cnt = 0; cnt < coeffs.length; cnt++) {
        out = runStage(coeffs[cnt], out);
      }
      return out;
    };

    var runMultiFilter = function (input, coeffs) {
      var cnt = 0;
      var out = [];
      for (cnt = 0; cnt < input.length; cnt++) {
        out.push(runFilter(input[cnt], coeffs));
      }
      return out;
    };

    var biquadResponse = function (params, s) {
      var Fs = params.Fs,
        Fr = params.Fr;
      // z = exp(j*omega*pi) = cos(omega*pi) + j*sin(omega*pi)
      // z^-1 = exp(-j*omega*pi)
      // omega is between 0 and 1. 1 is the Nyquist frequency.
      var theta = -Math.PI * (Fr / Fs) * 2;
      var z = {
        re: Math.cos(theta),
        im: Math.sin(theta)
      };
      // k * (b0 + b1*z^-1 + b2*z^-2) / (1 + a1*z^⁻1 + a2*z^-2)
      var p = complex.mul(s.k, complex.add(s.b0, complex.mul(z, complex.add(s.b1, complex.mul(s.b2, z)))));
      var q = complex.add(cone, complex.mul(z, complex.add(s.a1, complex.mul(s.a2, z))));
      var h = complex.div(p, q);
      var res = {
        magnitude: complex.magnitude(h),
        phase: complex.phase(h)
      };
      return res;
    };

    var calcResponse = function (params) {
      var cnt = 0;
      var res = {
        magnitude: 1,
        phase: 0
      };
      for (cnt = 0; cnt < cf.length; cnt++) {
        var r = biquadResponse(params, cf[cnt]);
        // a cascade of biquads results in the multiplication of H(z)
        // H_casc(z) = H_0(z) * H_1(z) * ... * H_n(z)
        res.magnitude *= r.magnitude;
        // phase is wrapped -> unwrap before using
        res.phase += r.phase;
      }
      res.dBmagnitude = 20 * Math.log(res.magnitude) * Math.LOG10E;
      return res;
    };

    var reinit = function () {
      var tempF = [];
      for (var cnt = 0; cnt < f.length; cnt++) {
        tempF[cnt] = {
          a: [f[cnt].a[0], f[cnt].a[1]],
          b: [f[cnt].b[0], f[cnt].b[1], f[cnt].b[2]],
          k: f[cnt].k,
          z: [0, 0]
        };
      }
      return tempF;
    };

    var calcInputResponse = function (input) {
      var tempF = reinit();
      return runMultiFilter(input, tempF);
    };

    var predefinedResponse = function (def, length) {
      var ret = {};
      var input = [];
      var cnt = 0;
      for (cnt = 0; cnt < length; cnt++) {
        input.push(def(cnt));
      }
      ret.out = calcInputResponse(input);
      var maxFound = false;
      var minFound = false;
      for (cnt = 0; cnt < length - 1; cnt++) {
        if (ret.out[cnt] > ret.out[cnt + 1] && !maxFound) {
          maxFound = true;
          ret.max = {
            sample: cnt,
            value: ret.out[cnt]
          };
        }
        if (maxFound && !minFound && ret.out[cnt] < ret.out[cnt + 1]) {
          minFound = true;
          ret.min = {
            sample: cnt,
            value: ret.out[cnt]
          };
          break;
        }
      }
      return ret;
    };

    var self = {
      singleStep: function (input) {
        return runFilter(input, f);
      },
      multiStep: function (input) {
        return runMultiFilter(input, f);
      },
      simulate: function (input) {
        return calcInputResponse(input);
      },
      stepResponse: function (length) {
        return predefinedResponse(function () {
          return 1;
        }, length);
      },
      impulseResponse: function (length) {
        return predefinedResponse(function (val) {
          if (val === 0) {
            return 1;
          } else {
            return 0;
          }
        }, length);
      },
      responsePoint: function (params) {
        return calcResponse(params);
      },
      response: function (resolution) {
        var res = [];
        var cnt = 0;
        var r = resolution * 2;
        for (cnt = 0; cnt < resolution; cnt++) {
          res[cnt] = calcResponse({
            Fs: r,
            Fr: cnt
          });
        }
        evaluatePhase(res);
        return res;
      }
    };
    return self;
  };
  if (typeof module === 'object' && module && typeof module.exports === 'object') {
    module.exports = Filter;
  } else {
    window.Filter = Filter;
    if (typeof define === 'function' && define.amd) {
      define(Filter);
    }
  }
})(window);