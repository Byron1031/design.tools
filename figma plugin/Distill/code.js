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
  function round2(value) {
    return Math.round(value * 100) / 100;
  }
  function cleanKey(value) {
    return value.trim().replace(/\s+/g, " ").toLowerCase();
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
  function alphaPercent(c) {
    return Math.round(c.a * 100);
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
  function roleFamily(name) {
    const n = cleanKey(name).replace(/[\s/_-]+/g, "");
    if (n.includes("largetitle")) return "largetitle";
    if (n.includes("subheadline")) return "subheadline";
    if (n.includes("headline")) return "headline";
    if (n.includes("title")) return "title";
    if (n.includes("body")) return "body";
    if (n.includes("callout")) return "callout";
    if (n.includes("footnote")) return "footnote";
    if (n.includes("caption")) return "caption";
    return n;
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
  function numericToWeightName(n) {
    var _a;
    const m = { 100: "thin", 200: "extralight", 300: "light", 400: "regular", 500: "medium", 600: "semibold", 700: "bold", 800: "extrabold", 900: "black" };
    return (_a = m[n]) != null ? _a : `w${n}`;
  }
  function normalizeWeightName(style) {
    const num = style.replace(/[\s\-_]+/g, "").toLowerCase();
    if (/^\d+$/.test(num)) return numericToWeightName(parseInt(num));
    return num.replace(/italic$/, "").replace(/oblique$/, "") || "regular";
  }
  function weightLabel(fontStyle, fontWeight) {
    const normalized = normalizeWeightName(fontStyle);
    if (normalized.startsWith("w") && /^w\d+$/.test(normalized)) return normalized;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  function typographySignature(fontFamily, fontSize, fontWeight) {
    return `${cleanKey(fontFamily)}|${round2(fontSize)}|${fontWeight}`;
  }
  function typographyFamilySizeKey(fontFamily, fontSize) {
    return `${cleanKey(fontFamily)}|${round2(fontSize)}`;
  }
  function lineHeightToPx(lineHeight, fontSize) {
    if (lineHeight.unit === "PIXELS") return round2(lineHeight.value);
    if (lineHeight.unit === "PERCENT") return round2(fontSize * lineHeight.value / 100);
    return 0;
  }
  function letterSpacingToPx(letterSpacing, fontSize) {
    if (letterSpacing.unit === "PIXELS") return round2(letterSpacing.value);
    if (letterSpacing.unit === "PERCENT") return round2(fontSize * letterSpacing.value / 100);
    return 0;
  }
  function typographyRecordFromStyle(style) {
    const fontWeight = styleToNumericWeight(style.fontName.style);
    return {
      id: style.id,
      name: style.name,
      fontFamily: style.fontName.family,
      fontStyle: style.fontName.style,
      fontSize: round2(style.fontSize),
      fontWeight,
      lineHeightPx: lineHeightToPx(style.lineHeight, style.fontSize),
      letterSpacingPx: letterSpacingToPx(style.letterSpacing, style.fontSize),
      signature: typographySignature(style.fontName.family, style.fontSize, fontWeight),
      remote: style.remote
    };
  }
  function findRoleIndex(segments) {
    return segments.findIndex((segment) => {
      const family = roleFamily(segment);
      return ["largetitle", "title", "headline", "subheadline", "body", "callout", "footnote", "caption"].includes(family);
    });
  }
  function findWeightIndex(segments) {
    const index = segments.findIndex((segment) => {
      const normalized = normalizeWeightName(segment);
      return ["thin", "extralight", "light", "regular", "medium", "semibold", "bold", "extrabold", "black"].includes(normalized) || /^w\d+$/.test(normalized);
    });
    return index >= 0 ? index : null;
  }
  function typographyTemplateFromRecord(record) {
    const segments = record.name.split("/").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) return null;
    const weightIndex = findWeightIndex(segments);
    const roleIndex = findRoleIndex(segments);
    if (roleIndex < 0) return null;
    const roleEnd = weightIndex !== null && weightIndex > roleIndex ? weightIndex - 1 : segments.length - 1;
    const roleSegments = segments.slice(roleIndex, roleEnd + 1);
    return {
      name: record.name,
      segments,
      prefixSegments: segments.slice(0, roleIndex),
      roleSegments,
      weightIndex,
      fontFamily: record.fontFamily,
      fontSize: record.fontSize,
      fontWeight: record.fontWeight,
      roleFamily: roleFamily(roleSegments.join(" ")),
      remote: record.remote,
      multiLayer: segments.length >= 3
    };
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
    var _a, _b, _c, _d, _e, _f, _g;
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
    const remoteTextStyleRecords = [];
    for (const id of styleIds) {
      try {
        const style = await figma.getStyleByIdAsync(id);
        if (style == null ? void 0 : style.remote) remoteStyleNames.push(style.name);
        if ((style == null ? void 0 : style.remote) && style.type === "TEXT") remoteTextStyleRecords.push(typographyRecordFromStyle(style));
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
    const localTextStyleRecords = localTextStyles.map(typographyRecordFromStyle);
    const typographyStyleRecords = [...localTextStyleRecords, ...remoteTextStyleRecords];
    const typographyStylesBySignature = /* @__PURE__ */ new Map();
    for (const record of typographyStyleRecords) {
      if (!typographyStylesBySignature.has(record.signature) || !record.remote) {
        typographyStylesBySignature.set(record.signature, record);
      }
    }
    const typographyTemplates = typographyStyleRecords.map(typographyTemplateFromRecord).filter((template) => Boolean(template));
    const typographyTemplatesByFamilySize = /* @__PURE__ */ new Map();
    for (const template of typographyTemplates) {
      const key = typographyFamilySizeKey(template.fontFamily, template.fontSize);
      const templates = (_a = typographyTemplatesByFamilySize.get(key)) != null ? _a : [];
      templates.push(template);
      typographyTemplatesByFamilySize.set(key, templates);
    }
    const typographyUsesMultiLayerNames = typographyTemplates.some((template) => template.multiLayer);
    for (const v of localVariables) {
      const col = localCollections.find((c) => c.id === v.variableCollectionId);
      if (!col) continue;
      const val = resolveVariableValue(v.valuesByMode[col.defaultModeId], localVariables, localCollections);
      if (v.resolvedType === "COLOR") valueNamesByGroup.colors.set(colorValueToString(val, true), v.name);
      if (v.resolvedType === "FLOAT" && v.name.toLowerCase().includes("radius") && typeof val === "number") valueNamesByGroup.radius.set(String(val), v.name);
    }
    for (const s of localTextStyles) valueNamesByGroup.typography.set(s.name, s.name);
    const colorCollectionName = (_c = (_b = localCollections.find((c) => c.name.toLowerCase().includes("color"))) == null ? void 0 : _b.name) != null ? _c : COLOR_COLLECTION;
    const typographyCollectionName = (_e = (_d = localCollections.find((c) => c.name.toLowerCase().includes("typography") || c.name.toLowerCase().includes("type"))) == null ? void 0 : _d.name) != null ? _e : TYPOGRAPHY_COLLECTION;
    const radiusCollectionName = (_g = (_f = localCollections.find((c) => c.name.toLowerCase().includes("radius"))) == null ? void 0 : _f.name) != null ? _g : RADIUS_COLLECTION;
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
      typographyStylesBySignature,
      typographyTemplates,
      typographyTemplatesByFamilySize,
      typographyUsesMultiLayerNames,
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
    if (c.a < 0.999) {
      const alpha = alphaPercent(c);
      if (hex === "000000") return `black-alpha/${alpha}`;
      if (hex === "ffffff") return `white-alpha/${alpha}`;
      return `alpha/${hex}/${alpha}`;
    }
    return `${audit.colorPrefix}/${hex}`;
  }
  function defaultTypographyName(fontSize, fontWeight, fontStyle, families, family) {
    const role = roleToStyleName(classifyStyle(fontSize, fontWeight));
    const base = `${role}/${fontStyle}`;
    return families.size > 1 ? `${base} \xB7 ${family}` : base;
  }
  function nearestTypographyTemplate(audit, fontFamily, fontSize, fontWeight) {
    if (!audit.typographyUsesMultiLayerNames) return null;
    const desiredRoleFamily = roleFamily(roleToStyleName(classifyStyle(fontSize, fontWeight)));
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const template of audit.typographyTemplates) {
      if (!template.multiLayer) continue;
      const fontPenalty = cleanKey(template.fontFamily) === cleanKey(fontFamily) ? 0 : 500;
      const rolePenalty = template.roleFamily === desiredRoleFamily ? 0 : 80;
      const sizePenalty = Math.abs(template.fontSize - fontSize) * 10;
      const weightPenalty = Math.abs(template.fontWeight - fontWeight) / 10;
      const remotePenalty = template.remote ? 4 : 0;
      const score = fontPenalty + rolePenalty + sizePenalty + weightPenalty + remotePenalty;
      if (score < bestScore) {
        best = template;
        bestScore = score;
      }
    }
    return best;
  }
  function nearestSameSizeTypographyTemplate(audit, fontFamily, fontSize, fontWeight) {
    var _a;
    const candidates = (_a = audit.typographyTemplatesByFamilySize.get(typographyFamilySizeKey(fontFamily, fontSize))) != null ? _a : [];
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const template of candidates) {
      const remotePenalty = template.remote ? 1e3 : 0;
      const completenessPenalty = Math.max(0, 8 - template.segments.length) * 5;
      const weightPenalty = Math.abs(template.fontWeight - fontWeight) / 10;
      const score = remotePenalty + completenessPenalty + weightPenalty;
      if (score < bestScore) {
        best = template;
        bestScore = score;
      }
    }
    return best;
  }
  function typographyNameFromTemplate(template, fontStyle, fontWeight) {
    const segments = [...template.prefixSegments, ...template.roleSegments];
    if (template.weightIndex !== null) segments.push(weightLabel(fontStyle, fontWeight));
    return segments.join("/");
  }
  function suggestTypographyName(audit, fontFamily, fontSize, fontWeight, fontStyle, families) {
    const fallback = defaultTypographyName(fontSize, fontWeight, fontStyle, families, fontFamily);
    const sameSizeTemplate = nearestSameSizeTypographyTemplate(audit, fontFamily, fontSize, fontWeight);
    if (sameSizeTemplate) return typographyNameFromTemplate(sameSizeTemplate, fontStyle, fontWeight);
    const template = nearestTypographyTemplate(audit, fontFamily, fontSize, fontWeight);
    if (!template) return fallback;
    const desiredRole = roleToStyleName(classifyStyle(fontSize, fontWeight));
    const desiredRoleFamily = roleFamily(desiredRole);
    const roleSegments = template.roleFamily === desiredRoleFamily ? template.roleSegments : [desiredRole];
    const adaptedTemplate = __spreadProps(__spreadValues({}, template), { roleSegments });
    return typographyNameFromTemplate(adaptedTemplate, fontStyle, fontWeight);
  }
  function formatSizeName(fontSize) {
    return Number.isInteger(fontSize) ? String(fontSize) : String(round2(fontSize));
  }
  function withTypographyDisambiguation(candidates, audit) {
    var _a, _b;
    const next = candidates.map((candidate) => __spreadValues({}, candidate));
    const names = /* @__PURE__ */ new Map();
    for (const candidate of next) {
      if (candidate.status === "new" || candidate.status === "invalid") {
        const group = (_a = names.get(candidate.targetName)) != null ? _a : [];
        group.push(candidate);
        names.set(candidate.targetName, group);
      }
    }
    for (const [name, group] of names) {
      if (group.length < 2 || audit.namesByGroup.typography.has(name)) continue;
      const uniqueSignatures = new Set(group.map((candidate) => candidate.valueKey));
      if (uniqueSignatures.size < 2) continue;
      for (const candidate of group) {
        if (candidate.nameOverride) continue;
        const disambiguatedName = `${candidate.targetName}/${formatSizeName(candidate.fontSize)}`;
        candidate.suggestedName = disambiguatedName;
        candidate.targetName = disambiguatedName;
      }
    }
    const secondPass = /* @__PURE__ */ new Map();
    for (const candidate of next) {
      if (candidate.status === "new" || candidate.status === "invalid") {
        const group = (_b = secondPass.get(candidate.targetName)) != null ? _b : [];
        group.push(candidate);
        secondPass.set(candidate.targetName, group);
      }
    }
    for (const [name, group] of secondPass) {
      if (group.length < 2 || audit.namesByGroup.typography.has(name)) continue;
      const uniqueSignatures = new Set(group.map((candidate) => candidate.valueKey));
      if (uniqueSignatures.size < 2) continue;
      for (const candidate of group) {
        if (candidate.nameOverride) continue;
        const disambiguatedName = `${candidate.targetName}/${weightLabel(candidate.fontStyle, candidate.fontWeight)}`;
        candidate.suggestedName = disambiguatedName;
        candidate.targetName = disambiguatedName;
      }
    }
    return next;
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
    if (candidate.group === "typography") {
      const typographyCandidate = candidate;
      const match = audit.typographyStylesBySignature.get(typographyCandidate.valueKey);
      if (match) {
        const secondaryDiffers = match.lineHeightPx !== typographyCandidate.lineHeightPx || match.letterSpacingPx !== typographyCandidate.letterSpacingPx;
        return __spreadProps(__spreadValues({}, typographyCandidate), {
          status: "match",
          targetName: match.name,
          matchedStyleId: match.id,
          matchedStyleRemote: match.remote,
          reason: secondaryDiffers ? "\u6838\u5FC3\u5C5E\u6027\u5339\u914D\uFF1B\u63D0\u4EA4\u540E\u5C06\u7ED1\u5B9A\u5230\u5DF2\u6709\u5E93\u6837\u5F0F" : "\u6838\u5FC3\u5C5E\u6027\u5339\u914D\u5DF2\u6709\u6587\u5B57\u6837\u5F0F"
        });
      }
      if (names.has(typographyCandidate.targetName)) {
        return __spreadProps(__spreadValues({}, typographyCandidate), { status: "conflict", reason: "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u6587\u5B57\u5C5E\u6027\u4E0D\u540C" });
      }
      return __spreadProps(__spreadValues({}, typographyCandidate), { status: "new", reason: void 0 });
    }
    if (!names.has(candidate.targetName)) return __spreadProps(__spreadValues({}, candidate), { status: "new", reason: void 0 });
    if (candidate.group === "colors") {
      const matchName = audit.valueNamesByGroup.colors.get(colorValueToString(value, true));
      return __spreadProps(__spreadValues({}, candidate), { status: matchName === candidate.targetName ? "match" : "conflict", reason: matchName === candidate.targetName ? "\u5DF2\u5B58\u5728\u540C\u503C\u989C\u8272" : "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u989C\u8272\u503C\u4E0D\u540C" });
    }
    if (candidate.group === "radius") {
      const matchName = audit.valueNamesByGroup.radius.get(String(value));
      return __spreadProps(__spreadValues({}, candidate), { status: matchName === candidate.targetName ? "match" : "conflict", reason: matchName === candidate.targetName ? "\u5DF2\u5B58\u5728\u540C\u503C\u5706\u89D2" : "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u6570\u503C\u4E0D\u540C" });
    }
    return candidate;
  }
  function validateDuplicates(groups, audit) {
    var _a;
    const next = { colors: [], typography: [], radius: [] };
    for (const group of Object.keys(groups)) {
      const candidates = group === "typography" ? withTypographyDisambiguation(groups[group], audit) : groups[group];
      const counts = /* @__PURE__ */ new Map();
      for (const c of candidates) {
        if (c.status === "new" || c.status === "invalid") counts.set(c.targetName, ((_a = counts.get(c.targetName)) != null ? _a : 0) + 1);
      }
      next[group] = candidates.map((c) => {
        var _a2;
        const invalid = isInvalidTokenName(c.targetName);
        if (invalid) return __spreadProps(__spreadValues({}, c), { status: "invalid", reason: invalid });
        if (group === "typography" && (c.status === "new" || c.status === "invalid")) {
          const typographyCandidate = c;
          const hasExistingName = audit.namesByGroup.typography.has(typographyCandidate.targetName);
          const hasExistingSignature = audit.typographyStylesBySignature.has(typographyCandidate.valueKey);
          if (hasExistingName && !hasExistingSignature) {
            return __spreadProps(__spreadValues({}, typographyCandidate), { status: "conflict", reason: "\u540D\u79F0\u5DF2\u5B58\u5728\u4F46\u6587\u5B57\u5C5E\u6027\u4E0D\u540C" });
          }
        }
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
    const radius = groups.radius;
    const statusOrder = {
      new: 0,
      invalid: 1,
      conflict: 2,
      match: 3,
      applied: 4,
      skip: 5
    };
    const compareStatus = (a, b) => statusOrder[a.status] - statusOrder[b.status];
    return {
      colors: [...groups.colors].sort((a, b) => compareStatus(a, b) || a.targetName.localeCompare(b.targetName)),
      typography: [...typography].sort((a, b) => {
        const status = compareStatus(a, b);
        if (status) return status;
        if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
        if (b.fontWeight !== a.fontWeight) return b.fontWeight - a.fontWeight;
        return a.targetName.localeCompare(b.targetName);
      }),
      radius: [...radius].sort((a, b) => compareStatus(a, b) || a.value - b.value || a.targetName.localeCompare(b.targetName))
    };
  }
  function isSelectableNode(node) {
    return "width" in node && "height" in node && node.width >= 32 && node.height >= 32;
  }
  function isIntegerRadius(value) {
    return value >= 0 && value === Math.round(value);
  }
  function radiusPropertiesForNode(node) {
    var _a;
    if (!("cornerRadius" in node) || !isSelectableNode(node)) return [];
    if (typeof node.cornerRadius === "number") {
      return isIntegerRadius(node.cornerRadius) ? [{ value: node.cornerRadius, properties: ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"] }] : [];
    }
    const values = [];
    const maybeCorner = node;
    for (const property of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) {
      const value = maybeCorner[property];
      if (typeof value === "number" && isIntegerRadius(value)) values.push({ property, value });
    }
    const byValue = /* @__PURE__ */ new Map();
    for (const item of values) {
      const properties = (_a = byValue.get(item.value)) != null ? _a : [];
      properties.push(item.property);
      byValue.set(item.value, properties);
    }
    return [...byValue.entries()].map(([value, properties]) => ({ value, properties }));
  }
  function collectSelectionCandidates(audit) {
    const selection = figma.currentPage.selection.filter((n) => "type" in n);
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
    for (const node of selection) collectTextFamilyGroups(node);
    function addRadiusRef(value, node, properties) {
      const key = String(value);
      const existing = radius.get(key);
      const ref = { group: "radius", nodeId: node.id, key, properties };
      if (existing) existing.refs.push(ref);
      else {
        const suggestedName = suggestRadiusName(audit, value);
        const candidate = {
          id: `radius:${key}`,
          group: "radius",
          status: "new",
          suggestedName,
          targetName: suggestedName,
          selected: true,
          value,
          valueKey: key,
          refs: [ref]
        };
        radius.set(key, classifyCandidate(candidate, audit, value));
      }
    }
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
              selected: true,
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
              selected: true,
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
          lineHeightPx = lineHeightToPx(node.lineHeight, node.fontSize);
        }
        let letterSpacingPx = 0;
        if (node.letterSpacing !== figma.mixed) {
          letterSpacingPx = letterSpacingToPx(node.letterSpacing, node.fontSize);
        }
        const fontWeight = styleToNumericWeight(fontName.style);
        const roleWeight = `${roleToStyleName(classifyStyle(node.fontSize, fontWeight))}/${fontName.style}`;
        const key = typographySignature(fontName.family, node.fontSize, fontWeight);
        const existing = typography.get(key);
        const ref = { group: "typography", nodeId: node.id, key };
        if (existing) existing.refs.push(ref);
        else {
          const suggestedName = suggestTypographyName(audit, fontName.family, node.fontSize, fontWeight, fontName.style, (_a = familiesByRoleWeight.get(roleWeight)) != null ? _a : /* @__PURE__ */ new Set([fontName.family]));
          const candidate = {
            id: `type:${key}`,
            group: "typography",
            status: "new",
            suggestedName,
            targetName: suggestedName,
            selected: true,
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
      for (const item of radiusPropertiesForNode(node)) addRadiusRef(item.value, node, item.properties);
      if ("children" in node) for (const child of node.children) collect(child);
    }
    for (const node of selection) collect(node);
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
      hasSelection: figma.currentPage.selection.length > 0,
      audit: (_a = currentAudit == null ? void 0 : currentAudit.summary) != null ? _a : null,
      proposal: currentProposal
    }, extra));
  }
  function renameCandidate(group, id, targetName) {
    if (!currentProposal || !currentAudit) return;
    const candidates = currentProposal.groups[group].map((c) => {
      if (c.id !== id || c.status !== "new" && c.status !== "invalid") return c;
      const nameOverride = targetName.trim() ? normalizeName(targetName) : "";
      return __spreadProps(__spreadValues({}, c), {
        nameOverride,
        targetName: nameOverride || c.suggestedName,
        status: "new",
        reason: void 0
      });
    });
    currentProposal.groups[group] = validateDuplicates(__spreadProps(__spreadValues({}, currentProposal.groups), { [group]: candidates }), currentAudit)[group];
    currentProposal.groups = sortCandidateGroups(currentProposal.groups);
    currentProposal.summaries = summarizeProposal(currentProposal.groups);
  }
  function toggleCandidateSelection(group, id, selected) {
    if (!currentProposal) return;
    currentProposal.groups[group] = currentProposal.groups[group].map((c) => {
      if (c.id !== id || c.status !== "new" && c.status !== "invalid") return c;
      return __spreadProps(__spreadValues({}, c), { selected });
    });
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
    var _a, _b;
    const collection = getOrCreateCollection((_a = currentAudit == null ? void 0 : currentAudit.summary.typographyCollectionName) != null ? _a : TYPOGRAPHY_COLLECTION);
    const existingStyles = await figma.getLocalTextStylesAsync();
    const byKey = /* @__PURE__ */ new Map();
    for (const c of candidates) {
      if (c.status === "match") {
        let matched = null;
        if (c.matchedStyleId) {
          try {
            const style2 = await figma.getStyleByIdAsync(c.matchedStyleId);
            if ((style2 == null ? void 0 : style2.type) === "TEXT") matched = style2;
          } catch (e) {
            matched = null;
          }
        }
        if (!matched) matched = (_b = existingStyles.find((s) => s.name === c.targetName)) != null ? _b : null;
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
    const selectedNodes = figma.currentPage.selection.filter((n) => "type" in n);
    for (const node of selectedNodes) {
      for (const item of radiusPropertiesForNode(node)) {
        const v = byKey.get(String(item.value));
        if (!v) continue;
        for (const property of item.properties) {
          try {
            node.setBoundVariable(property, v);
          } catch (e) {
          }
        }
      }
    }
    return byKey.size;
  }
  async function applyGroup(group) {
    if (!currentProposal) return;
    const candidates = currentProposal.groups[group].filter((c) => {
      if (c.status === "match") return true;
      return c.status === "new" && c.selected !== false;
    });
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
          if (figma.currentPage.selection.length === 0) {
            figma.notify("\u8BF7\u5148\u9009\u4E2D\u81F3\u5C11\u4E00\u4E2A\u56FE\u5C42\u6216 Frame", { error: true });
          } else {
            currentProposal = await buildProposal();
          }
        } else if (msg.type === "rename-token") {
          renameCandidate(msg.group, msg.id, msg.targetName);
        } else if (msg.type === "toggle-token-selection") {
          toggleCandidateSelection(msg.group, msg.id, msg.selected);
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
