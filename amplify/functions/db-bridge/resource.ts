import { defineFunction } from '@aws-amplify/backend'

const req = (name: string) => {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var ${name} (set it in Amplify console, values come from deploy-b.sh output)`)
  return v
}

export const dbBridge = defineFunction({
  name: 'db-bridge',
  entry: './handler.ts',
  runtime: 20,
  memoryMB: 256,
  timeoutSeconds: 15,
  environment: {
    DB_SECRET_ARN: req('BRIDGE_SECRET_ARN'),
    DB_HOST: req('BRIDGE_DB_HOST'),
    DB_PORT: req('BRIDGE_DB_PORT'),
    DB_NAME: req('BRIDGE_DB_NAME')
  }
})
