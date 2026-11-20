// Synced from Resnovas/.github templates/tools/lint/funnel.mjs. Edit it there.
import jsdoc from 'eslint-plugin-jsdoc'

const message = 'Do not assert that source code, a symbol or a source file is absent. Execute the affected public path and assert its observable behavior instead; retain legitimate output, redaction and UI absence assertions.'
const property = (node) => node?.type === 'MemberExpression' ? (node.computed ? node.property.value : node.property.name) : undefined

/** Follow local initializer provenance, not variable spelling, to distinguish source inspection from runtime output. */
export const noSourceAbsence = {
  meta: { type: 'problem', schema: [], messages: { behavior: message } },
  create(context) {
    const source = context.sourceCode
    const generated = new Map()
    const initializer = (node) => {
      if (node?.type !== 'Identifier') return undefined
      let scope = source.getScope(node)
      while (scope) {
        const variable = scope.set.get(node.name)
        if (variable) return variable.defs.find((definition) => definition.type === 'Variable')?.node.init
        scope = scope.upper
      }
    }
    const name = (node) => {
      if (node?.type === 'Identifier') {
        let scope = source.getScope(node)
        while (scope) {
          const variable = scope.set.get(node.name)
          if (variable) return variable.defs.find((definition) => definition.type === 'ImportBinding')?.node.imported?.name ?? node.name
          scope = scope.upper
        }
      }
      return node?.name ?? property(node)
    }
    const outputPath = (node) => generated.get(source.getScope(node).variableScope)?.has(source.getText(node)) === true
    const sourcePath = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return false
      seen.add(node)
      // A test-written fixture is observable program output, even when its extension is source code.
      if (outputPath(node)) return false
      if (node.type === 'Literal') return typeof node.value === 'string' && /\.(?:[cm]?[jt]sx?|py)$/.test(node.value)
      if (node.type === 'TemplateLiteral') return /\.(?:[cm]?[jt]sx?|py)$/.test(node.quasis.at(-1).value.cooked)
      if (node.type === 'Identifier') return sourcePath(initializer(node), seen)
      if (node.type === 'NewExpression' || node.type === 'CallExpression') return node.arguments.some((arg) => sourcePath(arg, seen))
      return false
    }
    const inspected = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return false
      seen.add(node)
      if (node.type === 'Identifier') return inspected(initializer(node), seen)
      if (node.type === 'AwaitExpression' || node.type === 'ChainExpression') return inspected(node.argument ?? node.expression, seen)
      if (node.type === 'MemberExpression') return inspected(node.object, seen)
      if (node.type !== 'CallExpression') return false
      const method = name(node.callee)
      if (['readFile', 'readFileSync', 'existsSync', 'access', 'accessSync'].includes(method) && sourcePath(node.arguments[0])) return true
      if (['getText', 'getSourceCode'].includes(method) && ['sourceCode', 'context'].includes(name(node.callee.object))) return true
      return inspected(node.callee.object, seen)
    }
    const report = (node) => context.report({ node, messageId: 'behavior' })
    return {
      UnaryExpression(node) {
        if (node.operator === '!' && inspected(node.argument)) report(node)
      },
      BinaryExpression(node) {
        if (['===', '=='].includes(node.operator) && ((node.right.value === false && inspected(node.left)) || (node.left.value === false && inspected(node.right)))) report(node)
      },
      CallExpression(node) {
        const method = name(node.callee)
        if (['writeFile', 'writeFileSync'].includes(method) && node.arguments[0]) {
          const scope = source.getScope(node).variableScope
          if (!generated.has(scope)) generated.set(scope, new Set())
          generated.get(scope).add(source.getText(node.arguments[0]))
        }
        if (method === 'doesNotMatch' && inspected(node.arguments[0])) report(node)
        if (['equal', 'strictEqual', 'deepEqual', 'deepStrictEqual'].includes(method) && node.arguments[1]?.value === false && inspected(node.arguments[0])) report(node)
        // Jest/Vitest negated matchers. Runtime-returned values do not carry source provenance.
        if (['toContain', 'toMatch', 'toHaveProperty', 'toBe', 'toEqual'].includes(method)) {
          let receiver = node.callee.object
          let negated = false
          if (property(receiver) === 'not') { negated = true; receiver = receiver.object }
          if (receiver?.type === 'CallExpression' && name(receiver.callee) === 'expect' && (negated || node.arguments[0]?.value === false) && inspected(receiver.arguments[0])) report(node)
        }
      },
    }
  },
}

/** Shared additive rules: callers retain their parser, boundaries, declaration contracts and rationale checks. */
export const funnel = {
  plugins: { jsdoc, house: { rules: { 'no-source-absence': noSourceAbsence } } },
  rules: {
    'house/no-source-absence': 'error',
    'jsdoc/informative-docs': ['error', { aliases: { run: ['runs', 'running'], main: ['entry', 'point'] } }],
  },
}

/** Apply to editable production TypeScript, alongside the repository's existing TypeScript parser. */
export const contracts = {
  plugins: { jsdoc },
  settings: { jsdoc: { mode: 'typescript' } },
  rules: {
    'jsdoc/require-jsdoc': ['error', {
      require: { ArrowFunctionExpression: true, ClassDeclaration: true, ClassExpression: true, FunctionDeclaration: true, FunctionExpression: true, MethodDefinition: true },
      contexts: ['TSInterfaceDeclaration', 'TSMethodSignature', 'TSDeclareFunction'],
      exemptEmptyConstructors: false,
      exemptEmptyFunctions: false,
    }],
    'jsdoc/require-description': 'error',
    'jsdoc/informative-docs': funnel.rules['jsdoc/informative-docs'],
  },
}
