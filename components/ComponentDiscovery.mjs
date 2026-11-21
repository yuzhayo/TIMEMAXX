// LOGIC — collect exports first; mounting is a separate stage after full validation.
export async function discoverComponents(loaders, diagnostics, sourceFolder = 'window') {
  const entries = await Promise.all(Object.entries(loaders).map(async ([source, load]) => {
    const prefix = new RegExp(`^\\.{1,2}/${sourceFolder}/`);
    const filePath = source.replace(prefix, '');
    try {
      const module = await load();
      // Empty skeletons and helpers are not renderable component registrations.
      if (module.componentId === undefined) return null;
      if (typeof module.componentId !== 'string' || !module.componentId.trim() || typeof module.default !== 'function') {
        diagnostics.report({ code: 'INVALID_COMPONENT_EXPORT', filePath, expected: 'stable componentId and default component', actual: module.componentId });
        return null;
      }
      const configKeys = module.configKeys ?? [];
      const partKeys = module.partKeys ?? [];
      const partConfigKeys = module.partConfigKeys ?? {};
      const requires = module.requires ?? [];
      const names = (values) => Array.isArray(values) && values.every((key) => typeof key === 'string' && /^[A-Za-z][\w.-]*$/.test(key)) && new Set(values).size === values.length;
      for (const [name, values] of Object.entries({ configKeys, partKeys, requires })) if (!names(values)) {
        diagnostics.report({ code: 'INVALID_COMPONENT_CONTRACT', componentId: module.componentId, filePath, expected: `export ${name}: unique valid names`, actual: values }); return null;
      }
      if (!partConfigKeys || typeof partConfigKeys !== 'object' || Array.isArray(partConfigKeys)
        || Object.entries(partConfigKeys).some(([part, values]) => !partKeys.includes(part) || !names(values))) {
        diagnostics.report({ code: 'INVALID_COMPONENT_CONTRACT', componentId: module.componentId, filePath,
          expected: 'export partConfigKeys: declared part names mapped to unique option keys', actual: partConfigKeys }); return null;
      }
      if ((configKeys.length > 0 || Object.keys(partConfigKeys).length > 0 || module.validateConfig !== undefined) && typeof module.validateConfig !== 'function') {
        diagnostics.report({ code: 'INVALID_COMPONENT_CONTRACT', componentId: module.componentId, filePath, expected: 'export validateConfig: pure function for custom options', actual: typeof module.validateConfig }); return null;
      }
      return { componentId: module.componentId, Component: module.default, configKeys, partKeys, partConfigKeys, requires, validateConfig: module.validateConfig, filePath, folder: filePath.slice(0, filePath.lastIndexOf('/')) };
    } catch (error) {
      diagnostics.report({ code: 'COMPONENT_LOAD_FAILED', filePath, expected: 'loadable component module', actual: error.message });
      return null;
    }
  }));
  return entries.filter(Boolean).sort((a, b) => a.filePath.localeCompare(b.filePath));
}
