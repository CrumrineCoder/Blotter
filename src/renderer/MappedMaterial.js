import "../core/";
import "../extras/";
import "../texture/";
import "_UniformUtils";


var fragmentSrc = [

  "precision highp float;",

  "uniform sampler2D uSampler;",
  "uniform sampler2D spriteIndices;",

  "uniform sampler2D textSpriteBoundsTexture;",
  "uniform sampler2D centerPointTexture;",
  "uniform sampler2D lenseWeightTexture;",

  "uniform float uTime;",
  "uniform float canvasWidth;",
  "uniform float canvasHeight;",

  "varying vec2 vTexCoord;",
  "float spriteIndex;",

  "void test( out vec4 spriteData ) {",
    "spriteData = texture2D(textSpriteBoundsTexture, vec2(spriteIndex, 0.5));",
  "}",

  "void main( void ) {",

  "   vec2 aspect = vec2(canvasWidth, canvasHeight).xy;",

  "   vec4 spriteIndexData = texture2D(spriteIndices, vTexCoord);",
  "   spriteIndex = spriteIndexData.x;",

  "   vec4 spriteData = vec4(0.0);",// = texture2D(textSpriteBoundsTexture, vec2(spriteIndex, 0.5));",
  "   test(spriteData);",

  "   // p = x, y percentage for texel position within of total resolution",
  "   vec2 p = (gl_FragCoord.xy - spriteData.xy) / spriteData.zw;",

  "   // m = x, y percentage for center position within total resolution",
  "   // note: you should know this, but swizzling allows access to vecN data using x,y,z, and w (or r, g, b, and a) in that order.",
  "   vec4 centerPointData = texture2D(centerPointTexture, vec2(spriteIndex, 0.5));",
  "   vec2 m = centerPointData.xy;",
  "   //vec2 m = vec2(0.5);",

  "   // d = difference between p and m (obviously, but see above).",
  "   vec2 d = p - m;",

  "   vec4 lenseWeightData = texture2D(lenseWeightTexture, vec2(spriteIndex, 0.5));",
  "   float lenseWeight = lenseWeightData.x;",

  "   // The dot function returns the dot product of the two",
  "   // input parameters, i.e. the sum of the component-wise",
  "   // products. If x and y are the same the square root of",
  "   // the dot product is equivalent to the length of the vector.",
  "   // Therefore, r = length of vector represented by d (the ",
  "   // distance of the texel from center position).",
  "   // In order to apply weights here, we add our weight to this distance",
  "   // (pushing it closer to 1 - essentially giving no effect at all) and",
  "   // find the min between our weighted distance and 1.0",
  "   float inverseLenseWeight = 1.0 - lenseWeight;",
  "   float r = min(sqrt(dot(d, d)) + inverseLenseWeight, 1.0);",

  "   vec2 offsetUV = m + (d * r);",

  "   vec2 adjustedFragCoord = spriteData.xy + vec2((spriteData.z * offsetUV.x), (spriteData.w * offsetUV.y));",
  "   vec2 uv = adjustedFragCoord.xy / aspect;",

  "   // RGB shift",
  "   vec2 offset = vec2(0.0);",
  "   if (r < 1.0) {",
  "     float amount = 0.0013;",
  "     float angle = 0.45;",
  "     offset = (amount * (1.0 - r)) * vec2(cos(angle), sin(angle));",
  "   }",
  "   vec4 cr = texture2D(uSampler, (uv + offset));",
  "   vec4 cga = texture2D(uSampler, uv);",
  "   vec4 cb = texture2D(uSampler, (uv - offset));",

  "   vec4 outColor = vec4(0.0);",
  "   if (cr.r > 0.0 || cga.g > 0.0 || cb.b > 0.0) {",
  "   //if (r < 1.0) {",
  "     // Adjust rgb values so that colors with transparency appear as if they were atop an opaque white background.",
  "     // (vec4(0.0, 0.0, 0.0, 0.5) _atop white_ is visibly the same as vec4(0.5, 0.5, 0.5, 0.0))",
  "     if (cr.a != 0.0) {",
  "       cr.r = cr.r + cr.a;",
  "     }",
  "     if (cga.a != 0.0) {",
  "       cga.g = cga.g + cga.a;",
  "     }",
  "     if (cb.b != 0.0) {",
  "       cb.b = cb.b + cb.a;",
  "     }",

  "     // Ensure offseted/shifted texels have alpha similar to the texel they are offsetting",
  "     // (this prevents texel from being invisible if cga.a = vec4(0.0, 0.0, 0.0, 0.0)",
  "     cga.a = max(cga.a, max(cr.a, cb.a));",

  "     // Set alpha adjustment value so that white texels keep their transparency.",
  "   	float alpha = 1.0 - cga.a;",
  "     // Invert colors (this is cheating but optimal) so that we have CMYK rather than RGB",
  "     // shifted colors and the combination of offsets creates a blacker rather than whiter color.",
  "     outColor = vec4((1.0 - cr.r) - alpha, (1.0 - cga.g) - alpha, (1.0 - cb.b) - alpha, cga.a);",
  "     //outColor = vec4(0.0, 1.0, 0.0, 1.0);",
  "   }",
  "   else {",
  "     outColor = vec4(cr.r, cga.g, cb.b, cga.a);",
  "     //outColor = vec4(1.0, 0.0, 0.0, 1.0);",
  "   }",

  "   // Multiply alpha by original spriteIndexData's alpha value.",
  "   // this will be 0 for texels not within any 'sprite' area.",
  "   outColor.a = outColor.a * spriteIndexData.a;",
  "   gl_FragColor = outColor;",
  "}"

].join("\n");

var vertexSrc = [

	"varying vec2 vTexCoord;",

	"void main() {",

	"  vTexCoord = uv;",
	"  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",

	"}"

].join("\n");







Blotter.MappedMaterial = function(mapper, shaderSrc, options) {
  this.init(mapper, shaderSrc, options);
}

Blotter.MappedMaterial.prototype = (function() {

	// Create object holding the name and values of every text specific uniform, each referencable through any given text.

  function _setTextsUniformsValues () {
    for (var uniformName in this.userDefinedUniforms) {
      if (this.userDefinedUniforms.hasOwnProperty(uniformName)) {
        for (var i = 0; i < this.mapper.texts.length; i++) {
          var text = this.mapper.texts[i],
              uniform = this.userDefinedUniforms[uniformName];

          if (blotter_UniformUtils.UniformTypes.indexOf(uniform.type) == -1) {
            blotter_Messaging.logError("Blotter.MappedMaterial", "user defined uniforms must be one of type: " +
              blotter_UniformUtils.UniformTypes.join(", "));
            return;
          }

          if (!blotter_UniformUtils.validValueForUniformType(uniform.type, uniform.value)) {
            blotter_Messaging.logError("Blotter.MappedMaterial", "user defined uniform value for " + uniformName + " is incorrect for type: " + uniform.type);
            return;
          }

          this.textsUniformsValues[text.id] = this.textsUniformsValues[text.id] || {};
          this.textsUniformsValues[text.id][uniformName] = JSON.parse(JSON.stringify(uniform));
        }
      }
    }
  }

  // Build object containing all uniforms we will pass to fragment shader.

  function _materialUniforms (callback) {
    var self = this,
        uniforms,
        userDefinedUniformTextures = _uniformsForUserDefinedUniformValues.call(this),
        indicesTexture = new blotter_TextsIndicesTexture(this.mapper, this.fidelityModifier),
        boundsTexture = new blotter_TextsBoundsTexture(this.mapper);

    indicesTexture.build(function(textSpriteIndicesTexture) {
      boundsTexture.build(function(textSpriteBoundsTexture) {

        uniforms = {
          uTime                  : { type: "f", value: 1.0 },
          uSampler               : { type: "t", value: self.textsTexture },
          spriteIndices          : { type: "t", value: textSpriteIndicesTexture },
          textSpriteBoundsTexture: { type: "t", value: textSpriteBoundsTexture },
          canvasWidth            : { type: "f", value: self.ratioAdjustedWidth },
          canvasHeight           : { type: "f", value: self.ratioAdjustedHeight }
        };
        for (var uniformName in userDefinedUniformTextures) {
          uniforms[uniformName] = userDefinedUniformTextures[uniformName];
        }

        callback(uniforms);
      });
    });
  }

  function _uniformTextureNameForUniformName (uniformName) {
    return uniformName + "Texture";
  }

  function _uniformsForUserDefinedUniformValues () {
    var uniformsAsTextures = {};

    for (var uniformName in this.userDefinedUniforms) {
      uniformsAsTextures[_uniformTextureNameForUniformName.call(this, uniformName)] = {
        value : _uniformTextureForUniformName.call(this, uniformName),
        type : "t"
      }
    }
    return uniformsAsTextures;
  }

  // Create a Data Texture holding the values for a specified uniform name that should be available to any given texel for any given text.

	function _uniformTextureForUniformName (uniformName) {
    var uniformDescription = this.userDefinedUniforms[uniformName],
        data = new Float32Array(this.mapper.texts.length * 4);

    if (!uniformDescription)
      blotter_Messaging.logError("Blotter.Composer", "cannot find uniformName for _uniformTextureForUniformName");

    for (var i = 0; i < this.mapper.texts.length; i++) {
      var text = this.mapper.texts[i],
          textUniformsValues = this.textsUniformsValues[text.id];

      if (textUniformsValues) {
        var textUniform = textUniformsValues[uniformName];

        switch (textUniform.type) {
          case '1f':
            data[4*i]   = textUniform.value; // x (r)
            data[4*i+1] = 0.0;
            data[4*i+2] = 0.0;
            data[4*i+3] = 0.0;
            break;

          case '2f':
            data[4*i]   = textUniform.value[0]; // x (r)
            data[4*i+1] = textUniform.value[1]; // y (g)
            data[4*i+2] = 0.0;
            data[4*i+3] = 0.0;
            break;

          case '3f':
            data[4*i]   = textUniform.value[0]; // x (r)
            data[4*i+1] = textUniform.value[1]; // y (g)
            data[4*i+2] = textUniform.value[2]; // z (b)
            data[4*i+3] = 0.0;
            break;

          case '4f':
            data[4*i]   = textUniform.value[0]; // x (r)
            data[4*i+1] = textUniform.value[1]; // y (g)
            data[4*i+2] = textUniform.value[2]; // z (b)
            data[4*i+3] = textUniform.value[3]; // w (a)
            break;

          default:
            data[4*i]   = 0.0;
            data[4*i+1] = 0.0;
            data[4*i+2] = 0.0;
            data[4*i+3] = 0.0;
            break;
        }
      }
      else {
        data[4*i]   = 0.0;
        data[4*i+1] = 0.0;
        data[4*i+2] = 0.0;
        data[4*i+3] = 0.0;
      }
    }

    var texture = new THREE.DataTexture(data, this.mapper.texts.length, 1, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;

    return texture;
  }


  return {

    constructor : Blotter.MappedMaterial,

    init : function(mapper, shaderSrc, options) {
      options = options || {};

      this.mapper = mapper;
      this.userDefinedUniforms = options.uniforms || {};

      // There is a negative coorelation between this value and
      // the speed at which texture generation happens.
      // However, the lower this value, the less fidelity you can expect
      // for indexing into uniforms for any given text.
      // Value must be between 0.0 and 1.0, and you are advised to keep it around 0.5.
      this.fidelityModifier = 0.5;

      this.pixelRatio = blotter_CanvasUtils.pixelRatio();
      this.width = this.mapper.width;
      this.height = this.mapper.height;
      this.ratioAdjustedWidth = this.width * this.pixelRatio;
      this.ratioAdjustedHeight = this.height * this.pixelRatio;

      // Setup text specific uniforms immediately.
      this.textsUniformsValues = {};
      _setTextsUniformsValues.call(this);
    },

    load : function(callback) {
      var self = this,
          loader = new THREE.TextureLoader(),
          url = this.mapper.getImage();

      // load a resource
      loader.load(url, function(textsTexture) {

        // Setup texture
        self.textsTexture = textsTexture;
        self.textsTexture.generateMipmaps = false;
        self.textsTexture.minFilter = THREE.LinearFilter;
        self.textsTexture.magFilter = THREE.LinearFilter;
        self.textsTexture.needsUpdate = true;

        _materialUniforms.call(self, function(uniforms) {

          self.threeMaterial = new THREE.ShaderMaterial({
            vertexShader: vertexSrc,
            fragmentShader: fragmentSrc,
            uniforms: uniforms
          });

          self.threeMaterial.depthTest = false;
          self.threeMaterial.depthWrite = false;

          callback();
        });
      });
    },

    updateUniformValueForText : function(text, uniformName, value) {
      var self = this,
          textsUniformsObject = this.textsUniformsValues[text.id];

      if (!textsUniformsObject) {
        blotter_Messaging.logError("Blotter.MappedMaterial", "cannot find text for updateUniformsForText");
        return;
      }

      if (!textsUniformsObject[uniformName]) {
        blotter_Messaging.logError("Blotter.MappedMaterial", "cannot find uniformName for updateUniformsForText");
        return;
      }

      if (!blotter_UniformUtils.validValueForUniformType(textsUniformsObject[uniformName].type, value)) {
        blotter_Messaging.logError("Blotter.MappedMaterial", "user defined uniform value for " + uniformName + " is incorrect for type: " + this.userDefinedUniforms[uniformName].type);
        return;
      }

      textsUniformsObject[uniformName].value = value;

      setTimeout(function() {
        // try using this.threeMaterial
        self.threeMaterial.uniforms[_uniformTextureNameForUniformName.call(self, uniformName)] = {
          type : "t",
          value : _uniformTextureForUniformName.call(self, uniformName)
        };
        self.threeMaterial.needsUpdate = true;
      }, 1);
    }
  }
})();

