import { Connection } from 'mongoose';
import { ClientModel as ClientModelDef } from '../../models/Client';

interface ClientLookupEntry {
  clientKey: number;
  clientName: string;
}

const clientLookupMap = new Map<string, ClientLookupEntry>();

export async function buildClientLookupMap(connection: Connection): Promise<void> {
  console.log('Building client lookup map...');
  
  // Register Client schema on this connection if not already registered
  const modelNames = connection.modelNames();
  if (!modelNames.includes('Client')) {
    connection.model('Client', ClientModelDef.schema);
  }
  const ClientConn = connection.model('Client');
  const clients = await ClientConn.find({}, {
    clientId: 1,
    clientKey: 1,
    'personalInfo.firstName': 1,
    'personalInfo.lastName': 1,
    'personalInfo.fullName': 1
  }).lean();
  
  clientLookupMap.clear();
  
  for (const client of clients as any[]) {
    if (client.clientId && client.clientKey) {
      const fullName = client.personalInfo?.fullName
        || `${client.personalInfo?.lastName || ''}, ${client.personalInfo?.firstName || ''}`.trim();

      clientLookupMap.set(String(client.clientId).trim(), {
        clientKey: client.clientKey,
        clientName: fullName
      });
    }
  }
  
  console.log(`[OK] Built client lookup map with ${clientLookupMap.size} entries`);
}

export function getClientKeyById(clientId: string): number | null {
  const entry = clientLookupMap.get(clientId?.trim());
  return entry?.clientKey || null;
}

export function getClientNameById(clientId: string): string {
  const entry = clientLookupMap.get(clientId?.trim());
  return entry?.clientName || '';
}

export function getClientKeyByIdOrThrow(clientId: string): number {
  const clientKey = getClientKeyById(clientId);
  if (clientKey === null) {
    throw new Error(`Client not found for clientId: ${clientId}`);
  }
  return clientKey;
}

export function hasClientId(clientId: string): boolean {
  return clientLookupMap.has(clientId?.trim());
}

export function getLookupMapSize(): number {
  return clientLookupMap.size;
}

export function clearClientLookupMap(): void {
  clientLookupMap.clear();
}
