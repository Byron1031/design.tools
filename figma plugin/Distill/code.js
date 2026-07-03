"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // code.ts
  var TOOL_ID = "9c676d1a-bbdf-48b8-8f4d-682bee3d9ac7";
  var DISPLAY_NAME = "Distill";
  var COLOR_COLLECTION = "Colors";
  var TYPOGRAPHY_COLLECTION = "Typography";
  var RADIUS_COLLECTION = "Radius";
  var isExecuting = false;
  var activeAction = null;
  var currentAudit = null;
  var currentProposal = null;
  function emptySummary() {
    return { match: 0, new: 0, conflict: 0, invalid: 0, skip: 0, applied: 0 };
  }
  function summarize(candidates) {
    const summary = emptySummary();
    for (const c of candidates) summary[c.status]++;
    return summary;
  }
  function summarizeProposal(groups) {
    return {
      colors: summarize(groups.colors),
      typography: summarize(groups.typography),
      radius: summarize(groups.radius)
    };
  }
  function normalizeName(name) {
    return name.trim().replace(/\s*\/\s*/g, "/").replace(/\s+/g, "-");
  }
  function isInvalidTokenName(name) {
    const n = name.trim();
    if (!n) return "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A";
    if (n.startsWith("/") || n.endsWith("/")) return "\u540D\u79F0\u4E0D\u80FD\u4EE5 / \u5F00\u5934\u6216\u7ED3\u5C3E";
    if (n.includes("//")) return "\u540D\u79F0\u4E0D\u80FD\u5305\u542B\u8FDE\u7EED //";
    return null;
  }
  function rgbToHex(r, g, b) {
    return [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
  }
  function colorKey(c) {
    return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.round(c.a * 100)}`;
  }
  function hexColor(c) {
    const hex = rgbToHex(c.r, c.g, c.b);
    if (c.a < 0.999) return `#${hex}${Math.round(c.a * 255).toString(16).padStart(2, "0")}`;
    return `#${hex}`;
  }
  function resolveVariableValue(value, variables, collections, visited = /* @__PURE__ */ new Set()) {
    let current = value;
    while (current && typeof current === "object" && "type" in current && current.type === "VARIABLE_ALIAS") {
      const aliasId = current.id;
      if (visited.has(aliasId)) return current;
      visited.add(aliasId);
      const aliasVar = variables.find((v) => v.id === aliasId);
      if (!aliasVar) return current;
      const aliasCol = collections.find((c) => c.id === aliasVar.variableCollectionId);
      if (!aliasCol) return current;
      current = aliasVar.valuesByMode[aliasCol.defaultModeId];
    }
    return current;
  }
  function colorValueToString(val, includeAlpha) {
    if (typeof val === "object" && val !== null && "r" in val) {
      const c = val;
      const hex = rgbToHex(c.r, c.g, c.b);
      if (includeAlpha && c.a !== void 0 && c.a < 0.999) {
        return `#${hex}${Math.round(c.a * 255).toString(16).padStart(2, "0")}`;
      }
      return `#${hex}`;
    }
    return String(val);
  }
  function classifyStyle(fontSize, fontWeight) {
    if (fontSize >= 34) return "largeTitle";
    if (fontSize >= 28) return "title1";
    if (fontSize >= 22) return "title2";
    if (fontSize >= 20) return "title3";
    if (fontSize >= 17) return fontWeight >= 600 ? "headline" : "body";
    if (fontSize >= 16) return "callout";
    if (fontSize >= 15) return "subheadline";
    if (fontSize >= 13) return "footnote";
    if (fontSize >= 12) return "caption1";
    return "caption2";
  }
  function roleToStyleName(role) {
    var _a;
    const iosNames = {
      largeTitle: "LargeTitle",
      title1: "Title1",
      title2: "Title2",
      title3: "Title3",
      headline: "Headline",
      body: "Body",
      callout: "Callout",
      subheadline: "Subheadline",
      footnote: "Footnote",
      caption1: "Caption1",
      caption2: "Caption2"
    };
    if (iosNames[role]) return iosNames[role];
    const [cat, sz] = role.split("/");
    const C = cat.charAt(0).toUpperCase() + cat.slice(1);
    const S = { lg: "Large", md: "Medium", sm: "Small", xl: "XLarge", xs: "XSmall" };
    return `${C}/${(_a = S[sz]) != null ? _a : sz.toUpperCase()}`;
  }
  function styleToNumericWeight(style) {
    const all = style.replace(/[\s\-_]+/g, "").toLowerCase();
    if (/^\d+$/.test(all)) return parseInt(all);
    const num = all.match(/\d+/);
    if (num) return parseInt(num[0]);
    if (all.includes("thin")) return 100;
    if (all.includes("extralight") || all.includes("ultralight")) return 200;
    if (all.includes("light")) return 300;
    if (all.includes("medium")) return 500;
    if (all.includes("semibold") || all.includes("demibold")) return 600;
    if (all.includes("extrabold") || all.includes("ultrabold")) return 800;
    if (all.includes("black") || all.includes("heavy")) return 900;
    if (all.includes("bold")) return 700;
    return 400;
  }
  function mostCommonPrefix(names, fallback) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const name of names) {
      const idx = name.indexOf("/");
      if (idx > 0) counts.set(name.slice(0, idx), ((_a = counts.get(name.slice(0, idx))) != null ? _a : 0) + 1);
    }
    let best = fallback;
    let count = 0;
    for (const [prefix, n] of counts) {
      if (n > count) {
        best = prefix;
        count = n;
      }
    }
    return best;
  }
  function isTypographyVariableName(name) {
    return /(^|\/|-)(font|type|text|line-height|letter-spacing|paragraph|weight|size)(\/|-|$)/i.test(name);
  }
  function collectVariableAliasIds(value, ids) {
    if (!value || typeof value !== "object") return;
    if ("type" in value && value.type === "VARIABLE_ALIAS" && "id" in value) {
      const id = value.id;
      if (typeof id === "string") ids.add(id);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectVariableAliasIds(item, ids);
      return;
    }
    for (const item of Object.values(value)) collectVariableAliasIds(item, ids);
  }
  async function auditLibraries() {
    var _a, _b, _c, _d, _e, _f;
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const localVariables = await figma.variables.getLocalVariablesAsync();
    const localTextStyles = await figma.getLocalTextStylesAsync();
    const nodes = figma.currentPage.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET", "INSTANCE"] });
    const localComponentNames = [];
    const remoteComponentNames = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      if (node.type === "INSTANCE") {
        try {
          const main = await node.getMainComponentAsync();
          if (main == null ? void 0 : main.remote) remoteComponentNames.add(main.name);
          else localComponentNames.push(node.name);
        } catch (e) {
          localComponentNames.push(node.name);
        }
      } else if (node.remote) {
        remoteComponentNames.add(node.name);
      } else {
        localComponentNames.push(node.name);
      }
    }
    const styleIds = /* @__PURE__ */ new Set();
    const boundVariableIds = /* @__PURE__ */ new Set();
    const styleNodes = figma.currentPage.findAll();
    function addStyleId(value) {
      if (typeof value === "string" && value) styleIds.add(value);
    }
    for (const node of styleNodes) {
      if ("fillStyleId" in node) addStyleId(node.fillStyleId);
      if ("strokeStyleId" in node) addStyleId(node.strokeStyleId);
      if ("textStyleId" in node) addStyleId(node.textStyleId);
      if ("effectStyleId" in node) addStyleId(node.effectStyleId);
      if ("boundVariables" in node) collectVariableAliasIds(node.boundVariables, boundVariableIds);
    }
    const remoteStyleNames = [];
    for (const id of styleIds) {
      try {
        const style = await figma.getStyleByIdAsync(id);
        if (style == null ? void 0 : style.remote) remoteStyleNames.push(style.name);
        if (style && "boundVariables" in style) collectVariableAliasIds(style.boundVariables, boundVariableIds);
      } catch (e) {
      }
    }
    const remoteVariables = [];
    const remoteAvailableVariables = [];
    const remoteBoundVariables = [];
    const remoteLibraryNames = /* @__PURE__ */ new Set();
    let remoteCollections = 0;
    try {
      const libs = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
      remoteCollections = libs.length;
      for (const lib of libs) {
        remoteLibraryNames.add(lib.libraryName || lib.name);
        try {
          const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(lib.key);
          for (const v of vars) {
            const remoteVar = { name: v.name, resolvedType: v.resolvedType, collectionName: lib.name };
            remoteVariables.push(remoteVar);
            remoteAvailableVariables.push(remoteVar);
          }
        } catch (e) {
        }
      }
    } catch (e) {
    }
    for (const id of boundVariableIds) {
      try {
        const variable = await figma.variables.getVariableByIdAsync(id);
        if (!(variable == null ? void 0 : variable.remote)) continue;
        const remoteVar = { name: variable.name, resolvedType: variable.resolvedType, collectionName: variable.variableCollectionId };
        remoteVariables.push(remoteVar);
        remoteBoundVariables.push(remoteVar);
        try {
          const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
          if (collection == null ? void 0 : collection.remote) remoteLibraryNames.add(collection.name);
        } catch (e) {
        }
      } catch (e) {
      }
    }
    const uniqueRemoteVariables = [
      ...new Map(remoteVariables.map((v) => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values()
    ];
    const uniqueRemoteAvailableVariables = [
      ...new Map(remoteAvailableVariables.map((v) => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values()
    ];
    const uniqueRemoteBoundVariables = [
      ...new Map(remoteBoundVariables.map((v) => [`${v.collectionName}:${v.resolvedType}:${v.name}`, v])).values()
    ];
    const colorNames = localVariables.filter((v) => v.resolvedType === "COLOR").map((v) => v.name);
    const radiusNames = localVariables.filter((v) => v.resolvedType === "FLOAT" && v.name.toLowerCase().includes("radius")).map((v) => v.name);
    const namesByGroup = {
      colors: /* @__PURE__ */ new Set([
        ...localVariables.filter((v) => v.resolvedType === "COLOR").map((v) => v.name),
        ...uniqueRemoteVariables.filter((v) => v.resolvedType === "COLOR").map((v) => v.name)
      ]),
      typography: /* @__PURE__ */ new Set([
        ...localTextStyles.map((s) => s.name),
        ...remoteStyleNames,
        ...localVariables.filter((v) => v.resolvedType === "FLOAT" || v.resolvedType === "STRING").map((v) => v.name),
        ...uniqueRemoteVariables.filter((v) => v.resolvedType === "FLOAT" || v.resolvedType === "STRING").map((v) => v.name)
      ]),
      radius: /* @__PURE__ */ new Set([
        ...radiusNames,
        ...uniqueRemoteVariables.filter((v) => v.resolvedType === "FLOAT" && v.name.toLowerCase().includes("radius")).map((v) => v.name)
      ])
    };
    const valueNamesByGroup = { colors: /* @__PURE__ */ new Map(), typography: /* @__PURE__ */ new Map(), radius: /* @__PURE__ */ new Map() };
    for (const v of localVariables) {
      const col = localCollections.find((c) => c.id === v.variableCollectionId);
      if (!col) continue;
      const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], localVariables, localCollections);
      if (v.resolvedType === "COLOR") valueNamesByGroup.colors.set(colorValueToString(val, true), v.name);
      if (v.resolvedType === "FLOAT" && v.name.toLowerCase().includes("radius") && typeof val === "number") valueNamesByGroup.radius.set(String(val), v.name);
    }
    for (const s of localTextStyles) valueNamesByGroup.typography.set(s.name, s.name);
    const colorCollectionName = (_b = (_a = localCollections.find((c) => c.name.toLowerCase().includes("color"))) == null ? void 0 : _a.name) != null ? _b : COLOR_COLLECTION;
    const typographyCollectionName = (_d = (_c = localCollections.find((c) => c.name.toLowerCase().includes("typography") || c.name.toLowerCase().includes("type"))) == null ? void 0 : _c.name) != null ? _d : TYPOGRAPHY_COLLECTION;
    const radiusCollectionName = (_f = (_e = localCollections.find((c) => c.name.toLowerCase().includes("radius"))) == null ? void 0 : _e.name) != null ? _f : RADIUS_COLLECTION;
    const localColorVariables = localVariables.filter((v) => v.resolvedType === "COLOR").length;
    const localTypographyVariables = localVariables.filter((v) => {
      const col = localCollections.find((c) => c.id === v.variableCollectionId);
      return ((col == null ? void 0 : col.name) === typographyCollectionName || isTypographyVariableName(v.name)) && v.resolvedType !== "COLOR";
    }).length;
    const remoteColorVariables = uniqueRemoteVariables.filter((v) => v.resolvedType === "COLOR").length;
    const remoteTypographyVariables = uniqueRemoteVariables.filter((v) => v.resolvedType !== "COLOR").length;
    const remoteAvailableColorVariables = uniqueRemoteAvailableVariables.filter((v) => v.resolvedType === "COLOR").length;
    const remoteAvailableTypographyVariables = uniqueRemoteAvailableVariables.filter((v) => v.resolvedType !== "COLOR").length;
    const remoteBoundColorVariables = uniqueRemoteBoundVariables.filter((v) => v.resolvedType === "COLOR").length;
    const remoteBoundTypographyVariables = uniqueRemoteBoundVariables.filter((v) => v.resolvedType !== "COLOR").length;
    const summary = {
      localCollections: localCollections.length,
      localVariables: localVariables.length,
      localColorVariables,
      localTypographyVariables,
      localTextStyles: localTextStyles.length,
      localComponents: localComponentNames.length,
      remoteComponents: remoteComponentNames.size,
      remoteStyles: remoteStyleNames.length,
      remoteCollections,
      remoteVariables: uniqueRemoteVariables.length,
      remoteColorVariables,
      remoteTypographyVariables,
      remoteAvailableColorVariables,
      remoteAvailableTypographyVariables,
      remoteBoundColorVariables,
      remoteBoundTypographyVariables,
      remoteLibraryNames: [...remoteLibraryNames],
      hasLocalLibrary: localCollections.length > 0 || localTextStyles.length > 0 || localComponentNames.length > 0,
      hasRemoteLibrary: remoteCollections > 0 || remoteVariables.length > 0 || remoteComponentNames.size > 0 || remoteStyleNames.length > 0,
      colorCollectionName,
      typographyCollectionName,
      radiusCollectionName
    };
    return {
      summary,
      localCollections,
      localVariables,
      localTextStyles,
      remoteVariables: uniqueRemoteVariables,
      remoteStyleNames,
      localComponentNames,
      remoteComponentNames: [...remoteComponentNames],
      namesByGroup,
      valueNamesByGroup,
      colorPrefix: mostCommonPrefix(colorNames, "color"),
      radiusPrefix: mostCommonPrefix(radiusNames, "radius")
    };
  }
  function suggestColorName(audit, c) {
    const existing = audit.valueNamesByGroup.colors.get(hexColor(c));
    if (existing) return existing;
    const hex = rgbToHex(c.r, c.g, c.b);
    if (c.a < 0.999) return `${audit.colorPrefix}/${hex}-alpha-${Math.round(c.a * 100)}`;
    return `${audit.colorPrefix}/${hex}`;
  }
  function suggestTypographyName(fontSize, fontWeight, fontStyle, families, family) {
    const role = roleToStyleName(classifyStyle(fontSize, fontWeight));
    const base = `${role}/${fontStyle}`;
    return families.size > 1 ? `${base} \xB7 ${family}` : base;
  }
  function suggestRadiusName(audit, value) {
    const existing = audit.valueNamesByGroup.radius.get(String(value));
    if (existing) return existing;
    return `${audit.radiusPrefix}/${value >= 9999 ? "full" : value}`;
  }
  function classifyCandidate(candidate, audit, value) {
    const invalid = isInvalidTokenName(candidate.targetName);
    if (invalid) return __spreadProps(__spreadValues({}, candidate), { status: "invalid", reason: invalid });
    const names = audit.namesByGroup[candidate.group];
    if (!names.has(candidate.targetName)) return __spreadProps(__spreadValues({}, candidate), { status: "new", reason: void 0 });
    if (candidate.group === "colors") {
      const matchName = audit.valueNamesByGroup.colors.get(colorValueToString(value, true));
      return __spreadProps(__spreadValues({}, candidate), { status: matchName === candidate.targetName ? "match" : "conflict", reason: matchName === candidate.targetName ? "\u5DF2\u5B58\u5728\u540C\u503C\u989C\u8272" : "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u989C\u8272\u503C\u4E0D\u540C" });
    }
    if (candidate.group === "radius") {
      const matchName = audit.valueNamesByGroup.radius.get(String(value));
      return __spreadProps(__spreadValues({}, candidate), { status: matchName === candidate.targetName ? "match" : "conflict", reason: matchName === candidate.targetName ? "\u5DF2\u5B58\u5728\u540C\u503C\u5706\u89D2" : "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u6570\u503C\u4E0D\u540C" });
    }
    return __spreadProps(__spreadValues({}, candidate), { status: names.has(candidate.targetName) ? "match" : "new", reason: names.has(candidate.targetName) ? "\u5DF2\u5B58\u5728\u540C\u540D\u6587\u5B57\u6837\u5F0F\u6216\u53D8\u91CF" : void 0 });
  }
  function validateDuplicates(groups, audit) {
    var _a;
    const next = { colors: [], typography: [], radius: [] };
    for (const group of Object.keys(groups)) {
      const counts = /* @__PURE__ */ new Map();
      for (const c of groups[group]) {
        if (c.status === "new" || c.status === "invalid") counts.set(c.targetName, ((_a = counts.get(c.targetName)) != null ? _a : 0) + 1);
      }
      next[group] = groups[group].map((c) => {
        var _a2;
        const invalid = isInvalidTokenName(c.targetName);
        if (invalid) return __spreadProps(__spreadValues({}, c), { status: "invalid", reason: invalid });
        if (((_a2 = counts.get(c.targetName)) != null ? _a2 : 0) > 1 && !audit.namesByGroup[group].has(c.targetName)) {
          return __spreadProps(__spreadValues({}, c), { status: "invalid", reason: "\u672C\u6B21\u65B0\u589E\u4E2D\u540D\u79F0\u91CD\u590D" });
        }
        return c;
      });
    }
    return next;
  }
  function sortCandidateGroups(groups) {
    const typography = groups.typography;
    return {
      colors: groups.colors,
      typography: [...typography].sort((a, b) => {
        if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
        if (b.fontWeight !== a.fontWeight) return b.fontWeight - a.fontWeight;
        return a.targetName.localeCompare(b.targetName);
      }),
      radius: groups.radius
    };
  }
  function collectSelectionCandidates(audit) {
    const frames = figma.currentPage.selection.filter((n) => n.type === "FRAME");
    const colors = /* @__PURE__ */ new Map();
    const typography = /* @__PURE__ */ new Map();
    const radius = /* @__PURE__ */ new Map();
    const familiesByRoleWeight = /* @__PURE__ */ new Map();
    function collectTextFamilyGroups(node) {
      if (node.type === "TEXT" && node.fontName !== figma.mixed && typeof node.fontSize === "number") {
        const fontName = node.fontName;
        const weight = styleToNumericWeight(fontName.style);
        const roleWeight = `${roleToStyleName(classifyStyle(node.fontSize, weight))}/${fontName.style}`;
        if (!familiesByRoleWeight.has(roleWeight)) familiesByRoleWeight.set(roleWeight, /* @__PURE__ */ new Set());
        familiesByRoleWeight.get(roleWeight).add(fontName.family);
      }
      if ("children" in node) for (const child of node.children) collectTextFamilyGroups(child);
    }
    for (const frame of frames) collectTextFamilyGroups(frame);
    function collect(node) {
      var _a;
      if ("fills" in node && Array.isArray(node.fills)) {
        node.fills.forEach((paint, paintIndex) => {
          var _a2;
          if (paint.type !== "SOLID" || paint.visible === false) return;
          const value = __spreadProps(__spreadValues({}, paint.color), { a: (_a2 = paint.opacity) != null ? _a2 : 1 });
          const key = colorKey(value);
          const existing = colors.get(key);
          const ref = { group: "colors", nodeId: node.id, property: "fills", paintIndex, key };
          if (existing) existing.refs.push(ref);
          else {
            const suggestedName = suggestColorName(audit, value);
            const candidate = {
              id: `color:${key}`,
              group: "colors",
              status: "new",
              suggestedName,
              targetName: suggestedName,
              value,
              valueKey: key,
              hex: hexColor(value),
              refs: [ref]
            };
            colors.set(key, classifyCandidate(candidate, audit, value));
          }
        });
      }
      if ("strokes" in node && Array.isArray(node.strokes)) {
        node.strokes.forEach((paint, paintIndex) => {
          var _a2;
          if (paint.type !== "SOLID" || paint.visible === false) return;
          const value = __spreadProps(__spreadValues({}, paint.color), { a: (_a2 = paint.opacity) != null ? _a2 : 1 });
          const key = colorKey(value);
          const existing = colors.get(key);
          const ref = { group: "colors", nodeId: node.id, property: "strokes", paintIndex, key };
          if (existing) existing.refs.push(ref);
          else {
            const suggestedName = suggestColorName(audit, value);
            const candidate = {
              id: `color:${key}`,
              group: "colors",
              status: "new",
              suggestedName,
              targetName: suggestedName,
              value,
              valueKey: key,
              hex: hexColor(value),
              refs: [ref]
            };
            colors.set(key, classifyCandidate(candidate, audit, value));
          }
        });
      }
      if (node.type === "TEXT" && node.fontName !== figma.mixed && typeof node.fontSize === "number") {
        const fontName = node.fontName;
        let lineHeightPx = null;
        if (node.lineHeight !== figma.mixed) {
          if (node.lineHeight.unit === "PIXELS") lineHeightPx = Math.round(node.lineHeight.value * 100) / 100;
          else if (node.lineHeight.unit === "PERCENT") lineHeightPx = Math.round(node.fontSize * node.lineHeight.value) / 100;
          else lineHeightPx = 0;
        }
        let letterSpacingPx = 0;
        if (node.letterSpacing !== figma.mixed) {
          if (node.letterSpacing.unit === "PIXELS") letterSpacingPx = Math.round(node.letterSpacing.value * 100) / 100;
          else if (node.letterSpacing.unit === "PERCENT") letterSpacingPx = Math.round(node.fontSize * node.letterSpacing.value) / 100;
        }
        const fontWeight = styleToNumericWeight(fontName.style);
        const roleWeight = `${roleToStyleName(classifyStyle(node.fontSize, fontWeight))}/${fontName.style}`;
        const key = `${fontName.family}|${node.fontSize}|${fontName.style}|${lineHeightPx != null ? lineHeightPx : "auto"}|${letterSpacingPx}`;
        const existing = typography.get(key);
        const ref = { group: "typography", nodeId: node.id, key };
        if (existing) existing.refs.push(ref);
        else {
          const suggestedName = suggestTypographyName(node.fontSize, fontWeight, fontName.style, (_a = familiesByRoleWeight.get(roleWeight)) != null ? _a : /* @__PURE__ */ new Set([fontName.family]), fontName.family);
          const candidate = {
            id: `type:${key}`,
            group: "typography",
            status: "new",
            suggestedName,
            targetName: suggestedName,
            fontFamily: fontName.family,
            fontStyle: fontName.style,
            fontSize: node.fontSize,
            fontWeight,
            lineHeightPx,
            letterSpacingPx,
            valueKey: key,
            refs: [ref]
          };
          typography.set(key, classifyCandidate(candidate, audit, suggestedName));
        }
      }
      if ("cornerRadius" in node && typeof node.cornerRadius === "number" && node.cornerRadius > 0 && node.cornerRadius === Math.round(node.cornerRadius)) {
        const w = "width" in node ? node.width : 0;
        const h = "height" in node ? node.height : 0;
        const value = node.cornerRadius;
        if (w >= 32 && h >= 32) {
          const key = String(value);
          const existing = radius.get(key);
          const ref = { group: "radius", nodeId: node.id, key };
          if (existing) existing.refs.push(ref);
          else {
            const suggestedName = suggestRadiusName(audit, value);
            const candidate = {
              id: `radius:${key}`,
              group: "radius",
              status: "new",
              suggestedName,
              targetName: suggestedName,
              value,
              valueKey: key,
              refs: [ref]
            };
            radius.set(key, classifyCandidate(candidate, audit, value));
          }
        }
      }
      if ("children" in node) for (const child of node.children) collect(child);
    }
    for (const frame of frames) collect(frame);
    return sortCandidateGroups(validateDuplicates({ colors: [...colors.values()], typography: [...typography.values()], radius: [...radius.values()] }, audit));
  }
  async function buildProposal() {
    const audit = currentAudit != null ? currentAudit : await auditLibraries();
    currentAudit = audit;
    const groups = collectSelectionCandidates(audit);
    return { audit: audit.summary, groups, summaries: summarizeProposal(groups) };
  }
  function postState(extra) {
    var _a;
    figma.ui.postMessage(__spreadValues({
      type: "state",
      isExecuting,
      activeAction,
      hasSelection: figma.currentPage.selection.some((n) => n.type === "FRAME"),
      audit: (_a = currentAudit == null ? void 0 : currentAudit.summary) != null ? _a : null,
      proposal: currentProposal
    }, extra));
  }
  function renameCandidate(group, id, targetName) {
    if (!currentProposal || !currentAudit) return;
    const candidates = currentProposal.groups[group].map((c) => {
      if (c.id !== id || c.status !== "new" && c.status !== "invalid") return c;
      return __spreadProps(__spreadValues({}, c), { targetName: normalizeName(targetName), status: "new", reason: void 0 });
    });
    currentProposal.groups[group] = validateDuplicates(__spreadProps(__spreadValues({}, currentProposal.groups), { [group]: candidates }), currentAudit)[group];
    currentProposal.groups = sortCandidateGroups(currentProposal.groups);
    currentProposal.summaries = summarizeProposal(currentProposal.groups);
  }
  function getOrCreateCollection(name) {
    const existing = currentAudit == null ? void 0 : currentAudit.localCollections.find((c) => c.name === name);
    return existing != null ? existing : figma.variables.createVariableCollection(name);
  }
  function getNode(id) {
    const node = figma.getNodeById(id);
    return node && "type" in node ? node : null;
  }
  function upsertVariable(name, value, type, collection) {
    const existing = currentAudit == null ? void 0 : currentAudit.localVariables.find((v) => v.variableCollectionId === collection.id && v.name === name);
    if (existing) {
      if (existing.resolvedType !== type) return null;
      try {
        existing.setValueForMode(collection.defaultModeId, value);
        return existing;
      } catch (e) {
        return null;
      }
    }
    try {
      const v = figma.variables.createVariable(name, collection, type);
      v.setValueForMode(collection.defaultModeId, value);
      return v;
    } catch (e) {
      return null;
    }
  }
  async function applyColors(candidates) {
    var _a, _b;
    const collection = getOrCreateCollection((_a = currentAudit == null ? void 0 : currentAudit.summary.colorCollectionName) != null ? _a : COLOR_COLLECTION);
    const byKey = /* @__PURE__ */ new Map();
    for (const c of candidates) {
      const v = c.status === "new" ? upsertVariable(c.targetName, { r: c.value.r, g: c.value.g, b: c.value.b, a: c.value.a }, "COLOR", collection) : (_b = currentAudit == null ? void 0 : currentAudit.localVariables.find((v2) => v2.name === c.targetName && v2.resolvedType === "COLOR")) != null ? _b : null;
      if (v) byKey.set(c.valueKey, v);
    }
    for (const c of candidates) {
      const v = byKey.get(c.valueKey);
      if (!v) continue;
      for (const ref of c.refs) {
        if (ref.group !== "colors") continue;
        const node = getNode(ref.nodeId);
        if (!node || !(ref.property in node)) continue;
        const paints = ref.property === "fills" && "fills" in node ? node.fills : ref.property === "strokes" && "strokes" in node ? node.strokes : [];
        const nextPaints = paints.slice();
        const paint = paints[ref.paintIndex];
        if (!paint || paint.type !== "SOLID") continue;
        nextPaints[ref.paintIndex] = figma.variables.setBoundVariableForPaint(paint, "color", v);
        try {
          if (ref.property === "fills" && "fills" in node) node.fills = nextPaints;
          if (ref.property === "strokes" && "strokes" in node) node.strokes = nextPaints;
        } catch (e) {
        }
      }
    }
    return byKey.size;
  }
  async function applyTypography(candidates) {
    var _a;
    const collection = getOrCreateCollection((_a = currentAudit == null ? void 0 : currentAudit.summary.typographyCollectionName) != null ? _a : TYPOGRAPHY_COLLECTION);
    const existingStyles = await figma.getLocalTextStylesAsync();
    const byKey = /* @__PURE__ */ new Map();
    for (const c of candidates) {
      if (c.status === "match") {
        const matched = existingStyles.find((s) => s.name === c.targetName);
        if (matched) byKey.set(c.valueKey, matched);
        continue;
      }
      upsertVariable(`${c.targetName}/font-size`, c.fontSize, "FLOAT", collection);
      upsertVariable(`${c.targetName}/font-weight`, c.fontWeight, "FLOAT", collection);
      upsertVariable(`${c.targetName}/font-family`, c.fontFamily, "STRING", collection);
      if (c.lineHeightPx === null || c.lineHeightPx === 0) upsertVariable(`${c.targetName}/line-height`, "auto", "STRING", collection);
      else upsertVariable(`${c.targetName}/line-height`, c.lineHeightPx, "FLOAT", collection);
      upsertVariable(`${c.targetName}/letter-spacing`, c.letterSpacingPx, "FLOAT", collection);
      let style = existingStyles.find((s) => s.name === c.targetName);
      try {
        await figma.loadFontAsync({ family: c.fontFamily, style: c.fontStyle });
        if (!style) {
          style = figma.createTextStyle();
          style.name = c.targetName;
        }
        style.fontName = { family: c.fontFamily, style: c.fontStyle };
        style.fontSize = c.fontSize;
        style.lineHeight = c.lineHeightPx === null || c.lineHeightPx === 0 ? { unit: "AUTO" } : { unit: "PIXELS", value: c.lineHeightPx };
        style.letterSpacing = { unit: "PIXELS", value: c.letterSpacingPx };
        byKey.set(c.valueKey, style);
      } catch (e) {
      }
    }
    for (const c of candidates) {
      const style = byKey.get(c.valueKey);
      if (!style) continue;
      for (const ref of c.refs) {
        if (ref.group !== "typography") continue;
        const node = getNode(ref.nodeId);
        if ((node == null ? void 0 : node.type) !== "TEXT") continue;
        try {
          await node.setTextStyleIdAsync(style.id);
        } catch (e) {
        }
      }
    }
    return byKey.size;
  }
  async function applyRadius(candidates) {
    var _a, _b;
    const collection = getOrCreateCollection((_a = currentAudit == null ? void 0 : currentAudit.summary.radiusCollectionName) != null ? _a : RADIUS_COLLECTION);
    const byKey = /* @__PURE__ */ new Map();
    for (const c of candidates) {
      const v = c.status === "new" ? upsertVariable(c.targetName, c.value, "FLOAT", collection) : (_b = currentAudit == null ? void 0 : currentAudit.localVariables.find((v2) => v2.name === c.targetName && v2.resolvedType === "FLOAT")) != null ? _b : null;
      if (v) byKey.set(c.valueKey, v);
    }
    for (const c of candidates) {
      const v = byKey.get(c.valueKey);
      if (!v) continue;
      for (const ref of c.refs) {
        if (ref.group !== "radius") continue;
        const node = getNode(ref.nodeId);
        if (!node || !("cornerRadius" in node)) continue;
        try {
          node.setBoundVariable("topLeftRadius", v);
          node.setBoundVariable("topRightRadius", v);
          node.setBoundVariable("bottomLeftRadius", v);
          node.setBoundVariable("bottomRightRadius", v);
        } catch (e) {
        }
      }
    }
    return byKey.size;
  }
  async function applyGroup(group) {
    if (!currentProposal) return;
    const candidates = currentProposal.groups[group].filter((c) => c.status === "new" || c.status === "match");
    if (candidates.length === 0) {
      figma.notify("\u6CA1\u6709\u53EF\u6DFB\u52A0\u6216\u7ED1\u5B9A\u7684 token");
      return;
    }
    let applied = 0;
    if (group === "colors") applied = await applyColors(candidates);
    if (group === "typography") applied = await applyTypography(candidates);
    if (group === "radius") applied = await applyRadius(candidates);
    currentProposal.groups[group] = currentProposal.groups[group].map((c) => candidates.some((a) => a.id === c.id) ? __spreadProps(__spreadValues({}, c), { status: "applied", reason: c.status === "match" ? "\u5DF2\u590D\u7528\u672C\u5730\u5339\u914D\u9879\u5E76\u7ED1\u5B9A" : "\u5DF2\u6DFB\u52A0\u5E76\u7ED1\u5B9A" }) : c);
    currentProposal.summaries = summarizeProposal(currentProposal.groups);
    currentAudit = await auditLibraries();
    figma.notify(`\u5DF2\u6DFB\u52A0 ${applied} \u4E2A ${group} token \u5E76\u5C1D\u8BD5\u7ED1\u5B9A`);
  }
  async function buildExportPayload() {
    const allVars = await figma.variables.getLocalVariablesAsync();
    const allCols = await figma.variables.getLocalVariableCollectionsAsync();
    const colorCol = allCols.find((c) => {
      var _a;
      return c.name === ((_a = currentAudit == null ? void 0 : currentAudit.summary.colorCollectionName) != null ? _a : COLOR_COLLECTION);
    });
    const typographyCol = allCols.find((c) => {
      var _a;
      return c.name === ((_a = currentAudit == null ? void 0 : currentAudit.summary.typographyCollectionName) != null ? _a : TYPOGRAPHY_COLLECTION);
    });
    const radiusCol = allCols.find((c) => {
      var _a;
      return c.name === ((_a = currentAudit == null ? void 0 : currentAudit.summary.radiusCollectionName) != null ? _a : RADIUS_COLLECTION);
    });
    const colors = {};
    const typography = {};
    const radius = {};
    for (const v of allVars) {
      const col = allCols.find((c) => c.id === v.variableCollectionId);
      if (!col) continue;
      const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], allVars, allCols);
      if (colorCol && v.variableCollectionId === colorCol.id) colors[v.name] = colorValueToString(val, true);
      else if (typographyCol && v.variableCollectionId === typographyCol.id) typography[v.name] = typeof val === "number" ? val : String(val);
      else if (radiusCol && v.variableCollectionId === radiusCol.id) radius[v.name] = typeof val === "number" ? val : 0;
    }
    return { colors, typography, radius };
  }
  function tokensToJson(payload) {
    return JSON.stringify(payload, null, 2);
  }
  function tokensToCSS(payload) {
    const lines = [":root {"];
    for (const [key, val] of Object.entries(payload.colors)) lines.push(`  --${key.replace(/\//g, "-")}: ${val};`);
    for (const [key, val] of Object.entries(payload.typography)) {
      const cssVal = typeof val === "number" ? `${val}${key.includes("size") || key.includes("height") || key.includes("spacing") ? "px" : ""}` : val;
      lines.push(`  --${key.replace(/\//g, "-")}: ${cssVal};`);
    }
    for (const [key, val] of Object.entries(payload.radius)) lines.push(`  --${key.replace(/\//g, "-")}: ${val}px;`);
    lines.push("}");
    return lines.join("\n");
  }
  async function runExport(format) {
    const payload = await buildExportPayload();
    const totalVars = Object.keys(payload.colors).length + Object.keys(payload.typography).length + Object.keys(payload.radius).length;
    if (totalVars === 0) {
      figma.notify("\u6682\u65E0\u5DF2\u63D0\u4EA4 token\uFF0C\u8BF7\u5148\u6DFB\u52A0\u4E00\u7EC4 token", { error: true });
      return;
    }
    figma.ui.postMessage({ type: "download", format, content: format === "css" ? tokensToCSS(payload) : tokensToJson(payload) });
  }
  figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
  figma.showUI(__html__, { width: 420, height: 640 });
  figma.on("selectionchange", () => postState());
  postState();
  figma.ui.onmessage = (msg) => {
    void (async () => {
      if (msg.type === "resize") {
        figma.ui.resize(420, Math.max(320, Math.min(900, Math.round(msg.height))));
        return;
      }
      if (isExecuting) return;
      isExecuting = true;
      activeAction = msg.type === "audit" ? "audit" : msg.type === "extract-preview" ? "preview" : msg.type === "apply-group" ? `apply-${msg.group}` : msg.type === "export" ? "export" : null;
      postState();
      try {
        if (msg.type === "audit") {
          currentAudit = await auditLibraries();
          currentProposal = null;
        } else if (msg.type === "extract-preview") {
          if (!figma.currentPage.selection.some((n) => n.type === "FRAME")) {
            figma.notify("\u8BF7\u5148\u9009\u4E2D\u81F3\u5C11\u4E00\u4E2A Frame", { error: true });
          } else {
            currentProposal = await buildProposal();
          }
        } else if (msg.type === "rename-token") {
          renameCandidate(msg.group, msg.id, msg.targetName);
        } else if (msg.type === "apply-group") {
          await applyGroup(msg.group);
        } else if (msg.type === "export") {
          await runExport(msg.format);
        }
      } catch (error) {
        figma.notify(error instanceof Error ? error.message : String(error), { error: true });
      } finally {
        isExecuting = false;
        activeAction = null;
        postState();
      }
    })();
  };
})();
