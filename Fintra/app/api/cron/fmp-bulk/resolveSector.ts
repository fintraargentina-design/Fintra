// Fintra/app/api/cron/fmp-bulk/resolveSector.ts

type SectorResolution = {
  sector: string | null;
  source: 'profile' | 'peers' | 'unknown';
  confidence: number;
};

export function resolveSector(
  profile: any,
  peers: string[] | null,
  profilesMap: Map<string, any[]>
): SectorResolution {
  // 1️⃣ Directo desde profile
  const directSector = profile?.sector || profile?.Sector;
  if (directSector) {
    return {
      sector: directSector,
      source: 'profile',
      confidence: 1
    };
  }

  // 2️⃣ Inferir desde peers
  if (peers?.length) {
    const sectorCount: Record<string, number> = {};

    for (const peer of peers) {
      const peerProfile = profilesMap.get(peer)?.[0];
      const peerSector = peerProfile?.sector || peerProfile?.Sector;
      if (!peerSector) continue;

      sectorCount[peerSector] = (sectorCount[peerSector] ?? 0) + 1;
    }

    const entries = Object.entries(sectorCount);
    if (entries.length) {
      entries.sort((a, b) => b[1] - a[1]);
      const [sector, count] = entries[0];
      const total = entries.reduce((a, [, c]) => a + c, 0);

      return {
        sector,
        source: 'peers',
        confidence: Number((count / total).toFixed(2))
      };
    }
  }

  // 3️⃣ Sin resolución
  return {
    sector: null,
    source: 'unknown',
    confidence: 0
  };
}
