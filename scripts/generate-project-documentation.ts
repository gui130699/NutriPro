import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const projectRoot = resolve(scriptDirectory, '..')
const outputPath = join(projectRoot, 'NutriPro-projeto-completo.txt')

const excludedDirectories = new Set([
  '.git', '.firebase', 'node_modules', 'dist', 'playwright-report', 'test-results',
])
const excludedFiles = new Set([
  '.env', 'package-lock.json', basename(outputPath),
])
const includedExtensions = new Set([
  '.css', '.csv', '.html', '.json', '.md', '.mjs', '.rules', '.sql', '.svg', '.ts', '.tsx', '.txt', '.yml', '.yaml',
])
const maximumEmbeddedBytes = 1_000_000

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...await filesIn(path))
    } else if (entry.isFile()) {
      const extension = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : ''
      if (!excludedFiles.has(entry.name) && (entry.name === '.env.example' || includedExtensions.has(extension))) files.push(path)
    }
  }
  return files
}

function section(title: string): string {
  return `\n${title}\n${'='.repeat(title.length)}\n\n`
}

async function main() {
  const files = await filesIn(projectRoot)
  const generatedAt = new Date().toISOString()
  const lines = [
    'NUTRIPRO — PROJETO COMPLETO: DOCUMENTAÇÃO, COMANDOS E CÓDIGO-FONTE',
    '===================================================================',
    '',
    `Gerado em (UTC): ${generatedAt}`,
    'Codificação: UTF-8',
    '',
    'Este arquivo é uma visão autocontida do repositório. Ele reúne a documentação',
    'técnica existente e o conteúdo textual do código-fonte e das configurações.',
    'Arquivos binários, dependências instaladas, builds, relatórios temporários,',
    'package-lock.json e segredos (.env) são deliberadamente excluídos.',
    '',
    'COMANDOS PRINCIPAIS',
    '------------------',
    'npm ci                         Instala dependências de forma reprodutível',
    'npm run dev                    Inicia Vite em desenvolvimento',
    'npm run build                  Valida TypeScript e cria build de produção',
    'npm run preview                Serve o build localmente',
    'npm run lint                   Executa Oxlint',
    'npm run test:typecheck         Executa a verificação TypeScript',
    'npm run test                   Executa 81 testes unitários (Vitest)',
    'npm run test:firebase          Executa 21 testes de regras nos Emulators',
    'npm run test:e2e:firebase      Executa 13 fluxos autenticados nos Emulators',
    'npm run test:e2e               Executa 23 testes públicos (Playwright)',
    'npm run test:all               Executa a matriz automatizada completa',
    'npm run catalog:import -- ...  Gera os artefatos do catálogo alimentar',
    'npm run catalog:validate       Confere integridade do catálogo publicado',
    'npm run migrate:meals          Migra snapshots de refeições',
    'npm run migrate:food-usage     Migra contadores de uso de alimentos',
    'npm run pwa:icons              Gera ícones PWA',
    'npm run docs:complete          Regenera este documento',
    '',
    'CONFIGURAÇÃO INICIAL',
    '--------------------',
    '1. Instale Node.js 22 ou 24 LTS, JDK 21 e as dependências com npm ci.',
    '2. Copie .env.example para .env e preencha VITE_FIREBASE_*.',
    '3. Habilite Email/Senha no Firebase Authentication.',
    '4. Execute npm ci e npm run dev.',
    '5. Para publicar regras/hosting, use a Firebase CLI conforme firebase.json.',
  ]

  lines.push(section('ÁRVORE DE ARQUIVOS INCLUÍDOS'))
  lines.push(...files.map((file) => `- ${relative(projectRoot, file).replaceAll('\\', '/')}`))

  for (const file of files) {
    const relativePath = relative(projectRoot, file).replaceAll('\\', '/')
    const fileStat = await stat(file)
    lines.push(section(`ARQUIVO: ${relativePath}`))
    lines.push(`Tamanho: ${fileStat.size} bytes`)
    if (fileStat.size > maximumEmbeddedBytes) {
      lines.push(`Conteúdo omitido por exceder ${maximumEmbeddedBytes} bytes. Consulte o arquivo no repositório.`)
      continue
    }
    const content = await readFile(file, 'utf8')
    const hash = createHash('sha256').update(content).digest('hex')
    lines.push(`SHA-256: ${hash}`, '', '```')
    lines.push(content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'))
    lines.push('```')
  }

  lines.push('', 'FIM DO DOCUMENTO')
  await mkdir(projectRoot, { recursive: true })
  await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Documentação criada: ${outputPath}`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
