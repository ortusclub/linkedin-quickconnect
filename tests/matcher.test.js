const { matchContact, normalizeName } = require("../matcher");

describe("normalizeName", () => {
  test("lowercases and trims", () => {
    expect(normalizeName("  Helena Voss  ")).toBe("helena voss");
  });
  test("strips diacritics", () => {
    expect(normalizeName("José García")).toBe("jose garcia");
  });
  test("collapses non-alphanumerics into single spaces", () => {
    expect(normalizeName("Anne-Marie  O'Neill")).toBe("anne marie o neill");
  });
  test("returns empty for null/empty input", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName(null)).toBe("");
  });
});

const contacts = [
  { firstName: "Helena", lastName: "Voss",      fields: { sector: "FinTech" } },
  { firstName: "José",   lastName: "García",    fields: { sector: "SaaS" } },
  { firstName: "Anne-Marie", lastName: "Smith", fields: { sector: "Health" } },
  { firstName: "Helena", lastName: "von Berg",  fields: { sector: "Legal" } },
  { firstName: "John",   lastName: "Smith",     fields: { sector: "IT" } }
];

describe("matchContact — exact normalized match", () => {
  test("matches a clean first+last", () => {
    const m = matchContact("Helena Voss", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Helena");
    expect(m.lastName).toBe("Voss");
  });
  test("matches across diacritic difference", () => {
    const m = matchContact("Jose Garcia", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("José");
  });
  test("matches across hyphen normalisation", () => {
    const m = matchContact("Anne Marie Smith", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Anne-Marie");
  });
});

describe("matchContact — token containment fallback", () => {
  test("matches when LinkedIn has noise tokens (Jr., suffix)", () => {
    const m = matchContact("John Smith Jr.", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("John");
  });
  test("matches when LinkedIn has middle name not in sheet", () => {
    const m = matchContact("Helena Maria Voss", contacts);
    expect(m).not.toBeNull();
    expect(m.firstName).toBe("Helena");
    expect(m.lastName).toBe("Voss");
  });
});

describe("matchContact — refuses on ambiguity", () => {
  test("disambiguates rows with overlapping last names by exact token match", () => {
    const overlapping = [
      { firstName: "John", lastName: "Smith", fields: {} },
      { firstName: "John", lastName: "Smithson", fields: {} }
    ];
    expect(matchContact("John Smith", overlapping).lastName).toBe("Smith");
    expect(matchContact("John Smithson Esquire", overlapping).lastName).toBe("Smithson");
  });

  test("returns null when token containment hits multiple identical rows", () => {
    const trulyAmbiguous = [
      { firstName: "John", lastName: "Smith", fields: { sector: "A" } },
      { firstName: "John", lastName: "Smith", fields: { sector: "B" } }
    ];
    expect(matchContact("John Smith", trulyAmbiguous)).toBeNull();
  });

  test("returns null when the linkedin name is empty", () => {
    expect(matchContact("", contacts)).toBeNull();
    expect(matchContact(null, contacts)).toBeNull();
  });
  test("returns null on no match at all", () => {
    expect(matchContact("Mystery Person", contacts)).toBeNull();
  });
});

describe("matchContact — short last names don't substring-match", () => {
  test("rejects 'Joe An' row when LinkedIn shows 'Joe Anne Smith'", () => {
    const tricky = [
      { firstName: "Joe", lastName: "An", fields: {} }
    ];
    // 'an' is NOT a token in {joe, anne, smith}; substring of 'anne' must NOT match
    expect(matchContact("Joe Anne Smith", tricky)).toBeNull();
  });
});
