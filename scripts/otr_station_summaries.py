#!/usr/bin/env python3
"""Write search entries for the station-only shows (frontend/public/otr/stations/shows.json) into
frontend/public/otr/search.json, so they show up in /otr search and get a line in the now-playing box.

The catalog shows carry AI plot summaries from oldtime.radio. The harvested shows have no synopses
anywhere on archive.org (file metadata holds titles only), and inventing plots from titles would be
lying, so each line here is built only from what is known: a short description of the show (cast,
setting, network, years) plus whatever the episode's own title and date actually say (guests on a
variety show, a chapter in a serial, the broadcast date). Searching "Crosby", "Jack Webb", "serial"
or "1948" therefore hits these shows; searching for a plot detail does not, and should not.

Run after the harvest (otr_station_harvest.py calls it) or on its own:
    python3 scripts/otr_station_summaries.py
search.json format: { showId: [[epIndex, title, summary], ...] }. Entries for station-only shows are
replaced wholesale; catalog shows are never touched.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OTR = os.path.join(HERE, "..", "frontend", "public", "otr")
SHOWS = os.path.join(OTR, "stations", "shows.json")
SEARCH = os.path.join(OTR, "search.json")

# id -> (kind, one-sentence description used as the body of every episode line)
#   kinds: variety (title may name guests), serial (chapters in order), news, drama (self-contained stories),
#   sitcom, quiz, music, anthology, kids
ABOUT = {
    "sky-king": ("serial", "Sky King, the ABC juvenile adventure serial (1946-54) about Arizona rancher and pilot Schuyler King, his plane the Songbird, and his niece Penny and nephew Clipper"),
    "the-fat-man": ("drama", "The Fat Man, ABC's Dashiell Hammett detective series (1946-51) with J. Scott Smart as 240-pound private investigator Brad Runyon, who steps on the drugstore scale in every opening"),
    "jack-armstrong": ("serial", "Jack Armstrong, the All-American Boy, the Wheaties adventure serial (1933-51) that sent Hudson High's star athlete, Billy and Betty Fairfield and Uncle Jim around the world in quarter-hour chapters"),
    "ethel-and-albert": ("sitcom", "Ethel and Albert, Peg Lynch's gentle domestic comedy (1944-50 on ABC) about the Arbuckles of Sandy Harbor, with Lynch as Ethel and Alan Bunce as Albert"),
    "theatre-guild-on-the-air": ("anthology", "Theatre Guild on the Air (the U.S. Steel Hour), the Sunday-night hour of Broadway plays with Broadway and Hollywood stars, on ABC 1945-49 and NBC 1949-53"),
    "philco-radio-time": ("variety", "Philco Radio Time, Bing Crosby's ABC Wednesday-night show (1946-49), the first major network program recorded on tape, with John Scott Trotter's orchestra, the Charioteers and Ken Carpenter"),
    "stop-the-music": ("quiz", "Stop the Music, ABC's Sunday-night phone-in quiz hour (1948-52) with Bert Parks, Harry Salter's orchestra and a jackpot of prizes for naming the mystery melody"),
    "dick-tracy": ("serial", "Dick Tracy, the radio serial of Chester Gould's square-jawed detective, with Ned Wever as Tracy and his war against Flattop, Pruneface and the rest of the rogues' gallery (Blue/ABC 1943-48)"),
    "terry-and-the-pirates": ("serial", "Terry and the Pirates, the adventure serial from Milton Caniff's strip: Terry Lee, Pat Ryan, Connie and the Dragon Lady against pirates and Japanese agents in the Far East (Blue/ABC 1943-48)"),
    "the-greatest-story-ever-told": ("drama", "The Greatest Story Ever Told, ABC's Sunday dramatisation of the life and parables of Jesus (1947-56), sponsored by Goodyear without commercials, with Warren Parker as Jesus"),
    "breakfast-in-hollywood": ("variety", "Breakfast in Hollywood, Tom Breneman's morning audience show from his Vine Street restaurant (Blue/ABC 1943-48): orchid for the oldest lady, wacky hats, Hollywood guests"),
    "ladies-be-seated": ("quiz", "Ladies Be Seated, the ABC afternoon audience-participation show (1944-50) with Johnny Olson, then Tom Moore, and stunts and prizes for the women in the studio"),
    "big-jon-and-sparkie": ("kids", "Big Jon and Sparkie, Jon Arthur's ABC children's show (1950-58) with Sparkie the elf who wants to be a real boy, Mayor Plumpfront and the town of Cincinnati, also heard Saturday mornings as No School Today"),
    "the-railroad-hour": ("music", "The Railroad Hour, Gordon MacRae's half-hour condensations of operettas and musicals for the Association of American Railroads (ABC 1948-49, NBC 1949-54), with Carmen Dragon's orchestra"),
    "the-henry-morgan-show": ("variety", "The Henry Morgan Show, the acid satirist's ABC comedy half hour (1946-50) with Arnold Stang, Betty Garde and Art Carney, famous for mocking its own sponsors"),
    "walter-winchell": ("news", "Walter Winchell's Jergens Journal, the Sunday-night Blue/ABC newscast of gossip, politics and war news at machine-gun speed, opening to a telegraph key and 'Good evening, Mr. and Mrs. North and South America and all the ships at sea'"),
    "drew-pearson": ("news", "Drew Pearson's Sunday-evening Blue/ABC commentary (1941-53) from the Washington Merry-Go-Round columnist, with predictions and inside stories from the capital"),
    "hop-harrigan": ("serial", "Hop Harrigan, America's Ace of the Airways, the aviation adventure serial from the All-American comic (Blue/ABC 1942-46, Mutual 1946-48) with Hop, mechanic Tank Tinker and Gail Nolan"),
    "paul-whiteman": ("music", "Paul Whiteman, the 'King of Jazz' bandleader, hosting his Blue Network summer shows (1943) and the ABC Paul Whiteman Club record hour (1946-47) with guest singers and comics"),
    "cavalcade-of-america": ("drama", "Cavalcade of America, DuPont's anthology of American history (NBC 1940-53) with Hollywood stars in true stories of inventors, soldiers, pioneers and statesmen"),
    "jack-benny-nbc": ("variety", "The Jack Benny Program in its NBC years (1932-48) with Mary Livingstone, Rochester, Phil Harris, Dennis Day, Don Wilson and Mel Blanc: the vault, the Maxwell, the violin and the age of 39"),
    "jack-benny-1949": ("variety", "The Jack Benny Program in its first CBS season (1949-50), the Sunday 7:00 show with Mary Livingstone, Rochester, Phil Harris, Dennis Day, Don Wilson and Mel Blanc"),
    "fred-allen-1945": ("variety", "The Fred Allen Show (NBC 1945-49): Allen's Alley with Senator Claghorn, Titus Moody, Mrs. Nussbaum and Ajax Cassidy, Portland Hoffa, the feud with Jack Benny and the week's news skewered"),
    "kraft-music-hall": ("variety", "Kraft Music Hall, NBC's Thursday-night variety hour, with Bing Crosby as host (1936-46) and later Al Jolson (1947-49), guests, songs and the Kraft orchestra"),
    "truth-or-consequences": ("quiz", "Truth or Consequences, Ralph Edwards's NBC Saturday-night stunt quiz (1940-50): miss the question, pay the consequence, with Beulah the buzzer and audience stunts"),
    "a-date-with-judy": ("sitcom", "A Date with Judy, the NBC teenage comedy (1941-49) about Judy Foster, her boyfriend Oogie Pringle, her brother Randolph and her long-suffering parents"),
    "the-judy-canova-show": ("variety", "The Judy Canova Show, the hillbilly comedienne's NBC Saturday-night comedy and song half hour (1943-53) with Mel Blanc as Pedro and Joseph Kearns as Mr. Hemingway"),
    "people-are-funny": ("quiz", "People Are Funny, Art Linkletter's NBC audience-stunt show (1942-60): contestants sent out to do absurd things for prizes, and the results reported on the air"),
    "the-big-story": ("drama", "The Big Story, NBC's Pall Mall dramatisations (1947-55) of true cases cracked by a real newspaper reporter, who received a $500 award at the end of each show"),
    "dennis-day": ("sitcom", "A Day in the Life of Dennis Day, the NBC sitcom (1946-51) in which Jack Benny's tenor plays a small-town soda jerk at Willoughby's drugstore, pining for Mildred Anderson"),
    "can-you-top-this": ("variety", "Can You Top This?, the joke-topping panel show (NBC 1945-47, then Mutual and ABC) with Senator Ford, Harry Hershfield and Joe Laurie Jr. trading gags against the Laugh Meter"),
    "grand-ole-opry": ("music", "Grand Ole Opry, the NBC Saturday-night Prince Albert half hour from Nashville's Ryman Auditorium (1943-57) with Red Foley, Minnie Pearl, Hank Williams, Roy Acuff and the Opry regulars"),
    "your-hit-parade": ("music", "Your Hit Parade, the Lucky Strike countdown of the week's top songs (NBC Saturdays 1946-50) sung by Frank Sinatra, Snooky Lanson, Eileen Wilson and the Hit Paraders"),
    "the-roy-rogers-show": ("variety", "The Roy Rogers Show, the King of the Cowboys' Western variety and drama half hour (Mutual 1948-51, NBC 1951-55) with Dale Evans, Pat Brady, the Sons of the Pioneers and Trigger"),
    "beulah": ("sitcom", "Beulah, the CBS weeknight quarter-hour sitcom (1947-54) about the Hendersons' housekeeper, played by Hattie McDaniel, then Lillian and Amanda Randolph, with boyfriend Bill Jackson"),
    "life-with-luigi": ("sitcom", "Life with Luigi, the CBS comedy (1948-53) about Italian immigrant Luigi Basco (J. Carrol Naish) in Chicago, his night-school class, his friend Pasquale and Pasquale's daughter Rosa"),
    "mr-and-mrs-north": ("drama", "Mr. and Mrs. North, the CBS comedy-mystery (1942-54) with Joseph Curtin and Alice Frost as publisher Jerry North and his wife Pam, who keep stumbling over corpses in Greenwich Village"),
    "the-fbi-in-peace-and-war": ("drama", "The FBI in Peace and War, CBS's Thursday-night crime series (1944-58) from Frederick L. Collins's book, each case an FBI investigation, with Prokofiev's 'Love for Three Oranges' march as its theme"),
    "casey-crime-photographer": ("drama", "Casey, Crime Photographer, the CBS mystery (1943-55) with Staats Cotsworth as the Morning Express photographer, reporter Ann Williams and Ethelbert the bartender at the Blue Note Cafe"),
    "hallmark-playhouse": ("anthology", "Hallmark Playhouse, the CBS Thursday-night anthology (1948-53) hosted by novelist James Hilton, dramatising novels and stories with Hollywood casts for Hallmark cards"),
    "crime-classics": ("drama", "Crime Classics, Elliott Lewis's CBS series (1953-54) of true crimes from history, told with dry wit by narrator Thomas Hyland, from Lizzie Borden to the Borgias"),
    "romance": ("anthology", "Romance, the CBS anthology (1943-57) of love stories and adventure in exotic settings, produced in its later years by Norman Macdonnell with the Gunsmoke company of actors"),
    "big-town": ("drama", "Big Town, the newspaper crime drama (CBS 1937-48, NBC 1948-52) with Edward Pawley as crusading editor Steve Wilson of the Illustrated Press and Fran Carlon as Lorelei Kilbourne"),
    "blondie": ("sitcom", "Blondie, the sitcom from Chic Young's strip (CBS 1939-50) with Penny Singleton and Arthur Lake as Blondie and Dagwood Bumstead, Baby Dumpling, Daisy and Mr. Dithers"),
    "meet-corliss-archer": ("sitcom", "Meet Corliss Archer, the CBS teenage comedy (1943-56) about Corliss, her boyfriend Dexter Franklin and her father Harry, from F. Hugh Herbert's stories"),
    "the-thin-man": ("drama", "The Adventures of the Thin Man, the comedy-mystery from Dashiell Hammett's Nick and Nora Charles (NBC, CBS and Mutual 1941-50), with Les Damon and Claudia Morgan and plenty of cocktails"),
    "kate-smith-hour": ("variety", "The Kate Smith Hour, the CBS Friday-night variety hour (1937-45) with the singer of 'God Bless America', announcer Ted Collins, comedy sketches and guest stars"),
    "columbia-workshop": ("anthology", "Columbia Workshop, CBS's experimental drama laboratory (1936-47) where Norman Corwin, Archibald MacLeish, Orson Welles and Bernard Herrmann tried new forms of radio writing and sound"),
    "arthur-godfrey": ("variety", "Arthur Godfrey Time, the CBS morning show (1945-72) of talk, songs and ukulele from the Old Redhead, with Janette Davis, the Mariners, Tony Marvin and the Little Godfreys"),
    "captain-midnight": ("serial", "Captain Midnight, the Ovaltine aviation adventure serial (Mutual 1940-49) with the Secret Squadron, Chuck Ramsay, Joyce Ryan and Ichabod Mudd against Ivan Shark, and the Code-O-Graph decoder"),
    "tom-mix": ("serial", "Tom Mix Ralston Straight Shooters, the Western adventure serial (NBC 1933-42, Mutual 1944-50) with the cowboy star's name on the TM-Bar Ranch, Sheriff Mike Shaw, the Old Wrangler and Ralston cereal"),
    "bulldog-drummond": ("drama", "Bulldog Drummond, the Mutual mystery series (1941-54) about H.C. McNeile's gentleman adventurer Captain Hugh Drummond and his manservant Denny, opening to footsteps, a foghorn and two shots"),
    "the-cisco-kid": ("drama", "The Cisco Kid, the Western with the Robin Hood of the Old West and his sidekick Pancho (Mutual 1942-45, then syndicated with Jack Mather and Harry Lang), ending with 'Oh, Pancho!' 'Oh, Cisco!'"),
    "true-detective-mysteries": ("drama", "True Detective Mysteries, Mutual's Sunday-afternoon dramatisations (1936-58) of cases from True Detective magazine, with a $500 reward offered for the wanted criminal described at the end of each show"),
}

NET = {  # network to name in the line, by show
    "sky-king": "ABC", "the-fat-man": "ABC", "jack-armstrong": "NBC and ABC", "ethel-and-albert": "ABC", "theatre-guild-on-the-air": "ABC and NBC",
    "philco-radio-time": "ABC", "stop-the-music": "ABC", "dick-tracy": "Blue/ABC", "terry-and-the-pirates": "Blue/ABC", "the-greatest-story-ever-told": "ABC",
    "breakfast-in-hollywood": "Blue/ABC", "ladies-be-seated": "ABC", "big-jon-and-sparkie": "ABC", "the-railroad-hour": "ABC and NBC", "the-henry-morgan-show": "ABC",
    "walter-winchell": "Blue/ABC", "drew-pearson": "Blue/ABC", "hop-harrigan": "Blue/ABC and Mutual", "paul-whiteman": "Blue/ABC", "cavalcade-of-america": "NBC",
    "jack-benny-nbc": "NBC", "jack-benny-1949": "CBS", "fred-allen-1945": "NBC", "kraft-music-hall": "NBC", "truth-or-consequences": "NBC", "a-date-with-judy": "NBC",
    "the-judy-canova-show": "NBC", "people-are-funny": "NBC", "the-big-story": "NBC", "dennis-day": "NBC", "can-you-top-this": "NBC", "grand-ole-opry": "NBC",
    "your-hit-parade": "NBC", "the-roy-rogers-show": "Mutual and NBC", "beulah": "CBS", "life-with-luigi": "CBS", "mr-and-mrs-north": "CBS", "the-fbi-in-peace-and-war": "CBS",
    "casey-crime-photographer": "CBS", "hallmark-playhouse": "CBS", "crime-classics": "CBS", "romance": "CBS", "big-town": "CBS and NBC", "blondie": "CBS",
    "meet-corliss-archer": "CBS", "the-thin-man": "NBC, CBS and Mutual", "kate-smith-hour": "CBS", "columbia-workshop": "CBS", "arthur-godfrey": "CBS",
    "captain-midnight": "Mutual", "tom-mix": "NBC and Mutual", "bulldog-drummond": "Mutual", "the-cisco-kid": "Mutual", "true-detective-mysteries": "Mutual",
}

GUEST = re.compile(r"^(?:guests?:?\s*|guests? (?:are|is)\s*|guest -\s*|with\s+)", re.I)
CHAPTER = re.compile(r"\b(?:ep|episode|chapter|part|pt)\.?\s*0*(\d{1,3})\b", re.I)


def line(show_id, title, date, serial_pos=None, serial_total=None):
    kind, about = ABOUT.get(show_id, ("drama", show_id))
    t = (title or "").strip()
    bare = (not t) or bool(re.fullmatch(r"broadcast of .*", t, re.I))   # title carries nothing beyond the date
    when = (", first broadcast %s" % date) if date else ""
    if kind == "variety":
        if re.search(r"\bguests?\b", t, re.I):
            who = GUEST.sub("", t).strip(" .")
            who = re.sub(r"^(?:guests?\s*(?:is|are)\s*)", "", who, flags=re.I)
            plural = ("," in who) or (" and " in who) or (" & " in who)
            return "Broadcast of %s with guest%s %s. %s." % (date or "an unknown date", "s" if plural else "", who, about)
        if bare:
            return "Broadcast of %s. %s." % (date or "an unknown date", about)
        return "'%s'%s. %s." % (t, when, about)
    if kind == "news":
        return ("Broadcast of %s. %s." % (date or "an unknown date", about)) if bare else ("%s%s. %s." % (t, when, about))
    if kind == "serial":
        m = CHAPTER.search(t)
        if m: chap = "chapter %d of the serial" % int(m.group(1))
        elif serial_pos is not None: chap = "chapter %d of %d in the surviving run" % (serial_pos, serial_total)
        else: chap = "a chapter of the serial"
        return "'%s', %s%s. %s." % (t, chap, when, about)
    if kind in ("quiz", "music"):
        return ("Broadcast of %s. %s." % (date or "an unknown date", about)) if bare else ("'%s'%s. %s." % (t, when, about))
    # drama, sitcom, anthology, kids
    return "'%s'%s. %s." % (t, when, about)


def build(shows):
    out = {}
    for s in shows:
        rows = []
        n = len(s["eps"])
        for i, e in enumerate(s["eps"]):
            rows.append([i, e[0], line(s["id"], e[0], e[1], i + 1, n)])
        out[s["id"]] = rows
    return out


def main():
    shows = json.load(open(SHOWS))["shows"]
    missing = [s["id"] for s in shows if s["id"] not in ABOUT]
    if missing:
        print("no description for:", ", ".join(missing)); sys.exit(1)
    search = json.load(open(SEARCH))
    new = build(shows)
    for sid in list(search.keys()):
        if sid in ABOUT and sid not in new: del search[sid]   # a show dropped from the harvest
    search.update(new)
    with open(SEARCH, "w") as f:
        json.dump(search, f, separators=(",", ":"), ensure_ascii=False)
    total = sum(len(v) for v in new.values())
    print("search.json: %d station-only shows, %d episode lines (%.0f kB total)" % (len(new), total, os.path.getsize(SEARCH) / 1024))
    for sid in ("philco-radio-time", "jack-armstrong", "walter-winchell", "cavalcade-of-america", "stop-the-music", "grand-ole-opry"):
        if sid in new: print("  e.g.", new[sid][0][2][:150])


if __name__ == "__main__":
    main()
