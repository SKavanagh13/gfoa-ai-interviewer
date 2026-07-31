export type MemberProfile = {
  gfoaMemberId: string;
  email: string;
  name: string | null;
  title: string | null;
  organizationName: string | null;
  governmentType: string | null;
  stateOrRegion: string | null;
  organizationSizeBand: string | null;
  experienceBand: string | null;
};

export interface MemberDirectory {
  findByEmail(email: string): Promise<MemberProfile | null>;
}

const mockMembers: MemberProfile[] = [
  {
    gfoaMemberId: "mock-member-001",
    email: "matched.member@gfoa.org",
    name: "Jordan Lee",
    title: "Finance Director",
    organizationName: "Example City",
    governmentType: "Municipality",
    stateOrRegion: "Midwest",
    organizationSizeBand: "50,000-100,000",
    experienceBand: "10+ years",
  },
];

export class MockMemberDirectory implements MemberDirectory {
  async findByEmail(email: string): Promise<MemberProfile | null> {
    const normalizedEmail = normalizeDirectoryEmail(email);

    return (
      mockMembers.find(
        (member) => normalizeDirectoryEmail(member.email) === normalizedEmail,
      ) ?? null
    );
  }
}

export function getMemberDirectory(): MemberDirectory {
  return new MockMemberDirectory();
}

function normalizeDirectoryEmail(email: string): string {
  return email.trim().toLowerCase();
}
