import type { Language } from "@prisma/client";

/**
 * CAREGIVER LOCALISATION
 * -----------------------------------------------------------------
 * A dictionary of its own, deliberately separate from the elder one in
 * `dictionaries.ts`, for two reasons:
 *
 *  1. **Weight.** The elder dictionary ships on every elder page. The
 *     caregiver dashboard's vocabulary — filters, tables, scheduling
 *     forms — has no business being loaded on a screen showing four
 *     large buttons to somebody with a 4G connection in Jorhat.
 *
 *  2. **Voice.** These are different audiences. The elder side says
 *     "Let's begin"; this side says "Acknowledged today". Sharing one
 *     dictionary would drag the two registers together.
 *
 * The LANGUAGE is also separate, and that matters more than the file
 * layout: it lives on `CaregiverPreference`, not on the elder's
 * `UserPreference`. A daughter reading the dashboard in Assamese must
 * not thereby switch her mother's interface out from under her.
 *
 * English is the source of truth; Hindi and Assamese are partials and
 * anything missing falls back to English rather than rendering blank,
 * so a half-finished translation is safe to ship.
 *
 * These are hand-written translations, not machine output presented as
 * a feature.
 */

const en = {
  // --- shell & navigation ---
  caregiverLabel: "Caregiver",
  navSections: "Caregiver sections",
  navOverview: "Overview",
  navReminders: "Reminders",
  navAlerts: "Alerts",
  navNotes: "Notes",
  navSummary: "Summary",
  navMemories: "Memories",
  navSettings: "Settings",
  signOut: "Sign out",
  backToDashboard: "Back to dashboard",

  // --- shared actions ---
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  cancel: "Cancel",
  add: "Add",
  edit: "Edit",
  remove: "Remove",
  manage: "Manage",
  close: "Close",
  somethingWentWrong: "Something went wrong. Please try again.",

  // --- not connected ---
  notConnectedTitle: "No one is connected to your account yet.",
  notConnectedOverview:
    "Ask your family member to open their profile in Cognisaarthi and read out the connection code, then sign up again with it.",
  notConnectedAlerts:
    "Once you are connected, meaningful updates about their day will appear here.",
  notConnectedSettings:
    "Connect to a family member to manage their reminders, contacts and your notification settings.",
  notConnectedNotes:
    "Connect to a family member first, then you can keep notes about them.",
  notConnectedMemories:
    "Connect to a family member first, then you can add memories for them.",
  notConnectedReminders:
    "Connect to a family member first, then you can set up reminders for them.",
  notConnectedSummary:
    "Once connected, a daily and weekly summary will appear here.",

  // --- dashboard ---
  latestActivity: "latest activity",
  noActivitiesYet: "no activities recorded yet.",
  todaysOverview: "Today's overview",
  tileActivities: "Activities",
  tileActivitiesHint: "Completed today",
  tileReminders: "Reminders",
  tileRemindersHint: "Acknowledged today",
  tileRemindersNone: "None due",
  tileAverageScore: "Average score",
  tileAverageScoreHint: "Last 10 activities",
  needsAttention: "Needs attention",
  allAlerts: "All alerts",
  nothingNeedsAttention: "Nothing needs your attention right now.",
  memoryBank: "Memory bank",
  memoryBankHint: "Add people, places and moments for {name} to remember.",
  recentActivities: "Recent activities",
  nothingToShowYet: "Nothing to show yet.",
  noActivityStarted:
    "{name} has not started an activity. Scores will appear here as soon as they do.",
  recentActivitiesCaption: "Recent activities completed by {name}",
  colActivity: "Activity",
  colLevel: "Level",
  colScore: "Score",
  colTime: "Time",
  colWhen: "When",
  colStatus: "Status",

  /**
   * The disclaimer at the foot of the dashboard. Translated with care
   * — this is the sentence that stops a family reading a puzzle score
   * as a diagnosis, so it must be as plain in Assamese as in English.
   */
  notMedicalNotice:
    "These scores describe how the activities went, nothing more. They are not a medical measurement and should not be read as a sign of decline or improvement.",

  // --- alerts ---
  alertsTitle: "Alerts",
  filterAll: "All",
  filterUnread: "Unread",
  filterImportant: "Important",
  filterResolved: "Resolved",
  markRead: "Mark as read",
  markResolved: "Mark as resolved",
  dismiss: "Dismiss",
  noAlerts: "No alerts to show.",
  noAlertsBody: "Updates about the day will appear here when there are any.",
  alertsHeading: "Needs your attention",
  alertsEmptyTitle: "Nothing here right now.",
  alertsEmptyBody: "That is usually good news.",
  severityImportant: "Important",
  severityAttention: "Attention",
  severityInfo: "Info",
  statusUnread: "Unread",
  statusResolved: "Resolved",
  actionMarkRead: "Mark read",
  actionResolve: "Resolve",
  actionDismiss: "Dismiss",
  alertsNotMedicalNotice:
    "These are gentle signals drawn from activity and reminders. They are not a medical measurement and never a diagnosis.",

  // --- settings ---
  settingsTitle: "Settings",
  settingsLanguage: "Dashboard language",
  settingsLanguageHelp:
    "The language you read this dashboard in. This does not change what {name} sees on their own device.",
  settingsNotifications: "Notifications",
  settingsNotificationsHelp: "What you would like to be told about.",
  prefReminderNotifications: "Reminder updates",
  prefCognitiveActivityReminders: "Activity reminders",
  prefAlertNotifications: "Alerts",
  prefWeeklySummary: "Weekly summary",
  settingsTimeZone: "Time zone",
  settingsTimeZoneHelp:
    "Reminders for {name} are scheduled in this time zone.",
  emergencyTitle: "Emergency contacts",
  emergencyHelp:
    "The people {name} can reach from their Help screen. Cognisaarthi dials the number and nothing more — it never calls an emergency service on anyone's behalf.",
  contactName: "Name",
  contactPhone: "Phone number",
  contactRelationship: "Relationship",
  noContacts: "No contacts yet.",
  emergencyOneTap:
    "{name} can call these from their Help screen with one tap.",
  memoryBankSubtitle:
    "People, places and moments {name} may enjoy remembering.",
  settingsNotificationsInApp:
    "These control what you see in Cognisaarthi. All updates are in-app — Cognisaarthi does not send push, email or SMS in this version.",
  prefReminderHelp: "Show reminder activity for your family member.",
  prefActivityHelp: "Include gentle nudges towards the daily activity.",
  prefAlertsHelp: "Show meaningful updates in the alert center.",
  prefWeeklyHelp: "Keep the Cognisaarthi weekly summary switched on.",
  settingsTimeZoneTitle: "{name}'s timezone",
  settingsTimeZoneBody:
    "Reminders are scheduled in this timezone, so an 08:00 reminder stays at 08:00 where {name} is.",
  languageChangesOnlyYours:
    "This changes only your own dashboard. It does not change the language on {name}'s device.",

  // --- notes ---
  notesTitle: "Notes about {name}",
  notesHelp:
    "Short observations for you and anyone else caring for {name}. These are never shown to {name}, and they are never turned into a medical conclusion.",
  addNote: "Add a note",
  noteBody: "Note",
  noteCategory: "Category",
  noNotes: "No notes yet.",
  noteByYou: "You",

  // --- memories ---
  memoriesTitle: "{name}'s memories",
  memoriesHelp:
    "Anything you add here can appear in {name}'s Memories page and, if you allow it, in gentle recall activities. Only you and {name} can see these — photos are stored privately.",
  addMemory: "Add a memory",
  memoryTitleField: "Title",
  memoryCategory: "Category",
  memoryDescription: "Note",
  memoryPhoto: "Photo",
  memoryUseInActivities: "Use in recall activities",
  noMemories: "No memories yet.",

  // --- reminders ---
  remindersTitle: "Reminders for {name}",
  remindersHelp:
    "The daily routine {name} follows. A reminder is a prompt, never an instruction — Cognisaarthi cannot know whether anything was actually done, and never says that it does.",
  addReminder: "Add a reminder",
  reminderTitleField: "Title",
  reminderDescription: "Note",
  reminderCategory: "Category",
  reminderTime: "Time",
  reminderRepeat: "Repeats",
  reminderPriority: "Priority",
  reminderStartDate: "Starts",
  reminderEndDate: "Ends",
  reminderEnabled: "Active",
  noReminders: "No reminders yet.",

  // --- summary ---
  summaryTitle: "Summary",
  summaryToday: "Today",
  summaryThisWeek: "This week",
  summaryNotYetToday: "Not yet today",
  summaryCompleted: "Completed",

  // --- sign in & sign up ---
  signInTitle: "Sign in",
  signUpTitle: "Create an account",
  fieldName: "Your name",
  fieldEmail: "Email",
  fieldPassword: "Password",
  fieldConnectCode: "Connection code",
  connectCodeHelp:
    "Ask your family member to read out the code on their profile screen.",
  fieldRelationship: "Your relationship to them",
  haveAccount: "Already have an account?",
  needAccount: "Need an account?",

  // --- data freshness & offline ---
  updatedAt: "Updated at {time}",
  offlineNotice: "You are offline. These figures may be out of date.",
  openSavedView: "Open the saved view",
  savedViewTitle: "Saved view",
  savedViewReadOnly:
    "This is a saved copy on this device. You cannot make changes until you are back online.",

  // --- recent activity rows ---
  difficultyEasy: "Easy",
  difficultyMedium: "Medium",
  difficultyHard: "Hard",
  statusCompleted: "Completed",
  statusNotFinished: "Not finished",

  // --- suggested next ---
  suggestedTitle: "Suggested for {name} today",
  suggestedGentler:
    "Today's plan is deliberately shorter — recent activities have either been hard work or there has been a gap since the last one, so Cognisaarthi is asking less rather than more.",
  suggestedAllDone: "{name} has completed today's suggested activities.",
  suggestedOpensAtEasy: "Opens at the easy level.",
  suggestedOpensAtMedium: "Opens at the medium level.",
  suggestedOpensAtHard: "Opens at the hard level.",
  suggestedOptionalExtra:
    "An optional extra activity is offered if {name} wants to keep going. It is never presented as required.",

  // --- how personalisation works ---
  explainerTitle: "How Cognisaarthi personalises activities",
  explainerPoint1:
    "It looks at how recent activities went — how many answers were right.",
  explainerPoint2:
    "It considers response time and how steady the results have been.",
  explainerPoint3:
    "It adjusts the difficulty of the next activity gradually, one step at a time.",
  explainerPoint4:
    "It suggests a little more practice in areas that have been more challenging.",
  explainerPoint5:
    "It does not diagnose any medical condition, and these scores are not a medical measurement.",

  /**
   * Shown wherever the dashboard displays copy that Cognisaarthi
   * GENERATED — recommendation explanations and stored alert text.
   *
   * Those sentences are assembled by the deterministic engine in
   * lib/intelligence/explanations.ts, and alert text is written into
   * the database at the moment the alert is raised, so a historical
   * alert cannot be re-translated after the fact. Both remain English
   * for now. Saying so is better than letting a caregiver reading
   * Assamese assume the English paragraph is a translation failure.
   */

  // --- Phase 8: Memory Lane (caregiver side) ---
  //
  // Every status word below describes THE SCHEDULE, not the person.
  // "Needs reinforcement" means Memory Lane will show that photograph
  // more often; it is not a statement about anybody's memory, and the
  // explanatory line under the list says so in as many words.
  navMemoryLane: "Memory Lane",
  memoryLaneTitle: "Memory retention for {name}",
  memoryLaneHelp:
    "How {name}'s memories are travelling through Memory Lane's practice schedule. Recognising a photograph widens the gap before it comes round again; missing one narrows it. These are labels for the schedule, never a measurement of memory or a health assessment.",
  memoryLaneEmpty: "No memories have been practised yet.",
  memoryLaneEmptyHelp:
    "Once you add a memory and {name} opens Memory Lane, its history will appear here.",
  memoryLaneNotEnabled: "Not used in activities",
  // The dashboard's own notice opens "These scores…", which is wrong
  // on a page that shows no scores. This is the same promise, made
  // about the thing actually on the screen.
  memoryLaneNotMedical:
    "Memory Lane is a practice schedule, not an assessment. The labels above describe when a memory is shown again — nothing here measures anybody's memory or says anything about their health.",
  retentionNEW: "Not started",
  retentionLEARNING: "Learning",
  retentionBUILDING: "Building",
  retentionHOLDING: "Holding",
  retentionNEEDS_REINFORCEMENT: "Needs reinforcement",
  retentionNEWHelp: "This one has not come up yet.",
  retentionLEARNINGHelp: "Coming round often, in the same sitting.",
  retentionBUILDINGHelp: "The gaps are starting to widen.",
  retentionHOLDINGHelp: "Recognised across a week or more.",
  retentionNEEDS_REINFORCEMENTHelp:
    "Recently needed a hand, so it is coming round more often again.",
  outcomeRECOGNISED: "Recognised",
  outcomeASSISTED: "We showed the answer",
  outcomeNOT_RECOGNISED: "Needed a hand",
  outcomeSKIPPED: "Moved on",
  memoryLaneNextDue: "Next: {when}",
  memoryLaneDueNow: "Ready now",
  memoryLaneNoHistory: "Not practised yet",
  memoryLaneStatus: "Status",
  intervalSeconds: "{n} seconds",
  intervalMinutes: "{n} minutes",
  intervalOneMinute: "1 minute",
  intervalDays: "{n} days",
  intervalOneDay: "1 day",

  // --- Phase 8: familiar voice ---
  voiceTitle: "Familiar voice",
  voiceHelp:
    "Record yourself saying who this is — \u201cMa, this is Meera.\u201d Memory Lane plays it when the answer does not come. A recording is stored privately, exactly like the photograph.",
  voiceRecord: "Record",
  voiceStop: "Stop",
  voicePlay: "Play",
  voiceDelete: "Delete recording",
  voiceReplace: "Record again",
  voiceSaved: "Recording saved",
  voiceRecording: "Recording\u2026",
  voiceNone: "No recording yet",
  voiceHas: "Recorded",
  voiceUnsupported:
    "This browser cannot record audio. Try Chrome or Safari on a phone.",
  voiceDenied:
    "Cognisaarthi was not allowed to use the microphone. You can allow it in your browser settings.",
  voiceTooLong: "That recording is too long. Keep it under a minute.",
  voiceSaveFailed: "That recording could not be saved. Please try again.",
  voiceDeleteConfirm: "Delete this recording?",

  // --- Phase 8: memory manager (previously untranslated) ---
  memoryEditTitle: "Edit memory",
  memoryNameField: "Name",
  memoryRelationship: "Relationship",
  memoryRelationshipPlaceholder: "e.g. Daughter",
  memoryNoteOptional: "Short note (optional)",
  memoryPhotoOptional: "Photo (optional)",
  memoryPhotoHelp: "JPG, PNG or WebP, up to 5 MB. Stored privately.",
  memoryAvailable: "Available for memory activities",
  memoryHidden: "Hidden from activities",
  memorySave: "Save memory",
  memoryDeleteConfirm: "Delete \u201c{title}\u201d? This cannot be undone.",
  memoryNeedsTitle: "Please give this memory a name or title.",
  memoryNoneYet:
    "No memories yet. Add a family member or a favourite place to begin.",
  memoryCatPERSON: "Person",
  memoryCatPLACE: "Place",
  memoryCatTHING: "Thing",
  memoryCatMOMENT: "Moment",
  errorImageType:
    "That image type is not supported. Use a JPG, PNG or WebP photo.",
  errorImageSize: "That photo is too large. Please use one under 5 MB.",
  errorNoLinkedUser:
    "No connected family member was found for your account.",

  generatedCopyEnglishNote:
    "Cognisaarthi's own explanations and alert text are written in English for now.",
} as const;

export type CaregiverDict = Record<keyof typeof en, string>;

const hi: Partial<CaregiverDict> = {
  caregiverLabel: "देखभालकर्ता",
  navSections: "देखभालकर्ता अनुभाग",
  navOverview: "सारांश",
  navReminders: "याद दिलाने वाली बातें",
  navAlerts: "सूचनाएँ",
  navNotes: "टिप्पणियाँ",
  navSummary: "ब्यौरा",
  navMemories: "यादें",
  navSettings: "सेटिंग",
  signOut: "साइन आउट",
  backToDashboard: "डैशबोर्ड पर वापस",

  save: "सहेजें",
  saving: "सहेजा जा रहा है…",
  saved: "सहेज लिया",
  cancel: "रद्द करें",
  add: "जोड़ें",
  edit: "बदलें",
  remove: "हटाएँ",
  manage: "प्रबंधित करें",
  close: "बंद करें",
  somethingWentWrong: "कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।",

  notConnectedTitle: "अभी आपके खाते से कोई जुड़ा नहीं है।",
  notConnectedOverview:
    "अपने परिजन से कहिए कि वे कॉग्निसारथी में अपनी प्रोफ़ाइल खोलें और कनेक्शन कोड पढ़कर सुनाएँ, फिर उसी कोड से दोबारा साइन अप कीजिए।",
  notConnectedAlerts:
    "जुड़ जाने के बाद, उनके दिन की ज़रूरी बातें यहाँ दिखाई देंगी।",
  notConnectedSettings:
    "उनकी याद दिलाने वाली बातें, संपर्क और अपनी सूचना सेटिंग संभालने के लिए किसी परिजन से जुड़िए।",
  notConnectedNotes:
    "पहले किसी परिजन से जुड़िए, फिर आप उनके बारे में टिप्पणियाँ रख सकते हैं।",
  notConnectedMemories:
    "पहले किसी परिजन से जुड़िए, फिर आप उनके लिए यादें जोड़ सकते हैं।",
  notConnectedReminders:
    "पहले किसी परिजन से जुड़िए, फिर आप उनके लिए याद दिलाने वाली बातें बना सकते हैं।",
  notConnectedSummary:
    "जुड़ जाने के बाद, यहाँ रोज़ का और साप्ताहिक ब्यौरा दिखाई देगा।",

  latestActivity: "पिछली गतिविधि",
  noActivitiesYet: "अभी कोई गतिविधि दर्ज नहीं है।",
  todaysOverview: "आज का सारांश",
  tileActivities: "गतिविधियाँ",
  tileActivitiesHint: "आज पूरी हुईं",
  tileReminders: "याद दिलाने वाली बातें",
  tileRemindersHint: "आज स्वीकार की गईं",
  tileRemindersNone: "कोई नहीं",
  tileAverageScore: "औसत अंक",
  tileAverageScoreHint: "पिछली 10 गतिविधियाँ",
  needsAttention: "ध्यान देने योग्य",
  allAlerts: "सभी सूचनाएँ",
  nothingNeedsAttention: "अभी आपके ध्यान की कोई ज़रूरत नहीं है।",
  memoryBank: "यादों का संग्रह",
  memoryBankHint: "{name} को याद रखने के लिए लोग, जगहें और पल जोड़िए।",
  recentActivities: "हाल की गतिविधियाँ",
  nothingToShowYet: "अभी दिखाने को कुछ नहीं है।",
  noActivityStarted:
    "{name} ने अभी कोई गतिविधि शुरू नहीं की है। जैसे ही वे करेंगे, अंक यहाँ दिखने लगेंगे।",
  recentActivitiesCaption: "{name} द्वारा हाल में पूरी की गई गतिविधियाँ",
  colActivity: "गतिविधि",
  colLevel: "स्तर",
  colScore: "अंक",
  colTime: "समय",
  colWhen: "कब",
  colStatus: "स्थिति",

  notMedicalNotice:
    "ये अंक सिर्फ़ यह बताते हैं कि गतिविधियाँ कैसी रहीं, इससे ज़्यादा कुछ नहीं। ये कोई चिकित्सकीय माप नहीं हैं और इन्हें गिरावट या सुधार का संकेत नहीं समझना चाहिए।",

  alertsTitle: "सूचनाएँ",
  filterAll: "सभी",
  filterUnread: "बिना पढ़ी",
  filterImportant: "ज़रूरी",
  filterResolved: "निपटाई गईं",
  markRead: "पढ़ी हुई चिह्नित करें",
  markResolved: "निपटाई हुई चिह्नित करें",
  dismiss: "हटाएँ",
  noAlerts: "दिखाने के लिए कोई सूचना नहीं।",
  noAlertsBody: "दिन से जुड़ी बातें, जब होंगी, यहाँ दिखेंगी।",
  alertsHeading: "आपके ध्यान की ज़रूरत",
  alertsEmptyTitle: "अभी यहाँ कुछ नहीं है।",
  alertsEmptyBody: "आमतौर पर यह अच्छी ख़बर होती है।",
  severityImportant: "ज़रूरी",
  severityAttention: "ध्यान दें",
  severityInfo: "जानकारी",
  statusUnread: "बिना पढ़ी",
  statusResolved: "निपटाई गई",
  actionMarkRead: "पढ़ी हुई चिह्नित करें",
  actionResolve: "निपटाएँ",
  actionDismiss: "हटाएँ",
  alertsNotMedicalNotice:
    "ये गतिविधि और याद दिलाने वाली बातों से निकले हल्के संकेत हैं। ये कोई चिकित्सकीय माप नहीं हैं और कभी कोई निदान नहीं हैं।",

  settingsTitle: "सेटिंग",
  settingsLanguage: "डैशबोर्ड की भाषा",
  settingsLanguageHelp:
    "आप यह डैशबोर्ड जिस भाषा में पढ़ते हैं। इससे {name} को अपने डिवाइस पर जो दिखता है, वह नहीं बदलता।",
  settingsNotifications: "सूचनाएँ",
  settingsNotificationsHelp: "आप किन बातों की जानकारी चाहते हैं।",
  prefReminderNotifications: "याद दिलाने वाली बातों की जानकारी",
  prefCognitiveActivityReminders: "गतिविधि की याद",
  prefAlertNotifications: "सूचनाएँ",
  prefWeeklySummary: "साप्ताहिक ब्यौरा",
  settingsTimeZone: "समय क्षेत्र",
  settingsTimeZoneHelp:
    "{name} के लिए याद दिलाने वाली बातें इसी समय क्षेत्र के हिसाब से तय होती हैं।",
  emergencyTitle: "आपातकालीन संपर्क",
  emergencyHelp:
    "वे लोग जिन्हें {name} अपनी सहायता स्क्रीन से बुला सकते हैं। कॉग्निसारथी सिर्फ़ नंबर मिलाता है, इससे ज़्यादा कुछ नहीं — यह कभी किसी की ओर से आपातकालीन सेवा को फ़ोन नहीं करता।",
  contactName: "नाम",
  contactPhone: "फ़ोन नंबर",
  contactRelationship: "रिश्ता",
  noContacts: "अभी कोई संपर्क नहीं।",
  emergencyOneTap:
    "{name} इन्हें अपनी सहायता स्क्रीन से एक बार छूकर बुला सकते हैं।",
  memoryBankSubtitle:
    "वे लोग, जगहें और पल जिन्हें याद करना {name} को अच्छा लग सकता है।",
  settingsNotificationsInApp:
    "ये तय करते हैं कि आप कॉग्निसारथी में क्या देखेंगे। सभी सूचनाएँ ऐप के भीतर ही हैं — इस संस्करण में कॉग्निसारथी पुश, ईमेल या एसएमएस नहीं भेजता।",
  prefReminderHelp: "अपने परिजन की याद दिलाने वाली गतिविधि दिखाएँ।",
  prefActivityHelp: "रोज़ की गतिविधि की ओर हल्का संकेत शामिल करें।",
  prefAlertsHelp: "सूचना केंद्र में ज़रूरी बातें दिखाएँ।",
  prefWeeklyHelp: "कॉग्निसारथी का साप्ताहिक ब्यौरा चालू रखें।",
  settingsTimeZoneTitle: "{name} का समय क्षेत्र",
  settingsTimeZoneBody:
    "याद दिलाने वाली बातें इसी समय क्षेत्र के हिसाब से तय होती हैं, ताकि 08:00 की याद वहीं 08:00 पर रहे जहाँ {name} हैं।",
  languageChangesOnlyYours:
    "इससे सिर्फ़ आपका अपना डैशबोर्ड बदलता है। {name} के डिवाइस की भाषा नहीं बदलती।",

  notesTitle: "{name} के बारे में टिप्पणियाँ",
  notesHelp:
    "आपके और {name} की देखभाल करने वाले बाक़ी लोगों के लिए छोटी-छोटी बातें। ये {name} को कभी नहीं दिखाई जातीं, और इन्हें कभी किसी चिकित्सकीय निष्कर्ष में नहीं बदला जाता।",
  addNote: "टिप्पणी जोड़ें",
  noteBody: "टिप्पणी",
  noteCategory: "श्रेणी",
  noNotes: "अभी कोई टिप्पणी नहीं।",
  noteByYou: "आप",

  memoriesTitle: "{name} की यादें",
  memoriesHelp:
    "यहाँ आप जो कुछ जोड़ेंगे वह {name} के यादें पृष्ठ पर दिख सकता है और, यदि आप अनुमति दें, तो हल्की-फुल्की स्मरण गतिविधियों में भी। इन्हें सिर्फ़ आप और {name} देख सकते हैं — तस्वीरें निजी तौर पर रखी जाती हैं।",
  addMemory: "याद जोड़ें",
  memoryTitleField: "शीर्षक",
  memoryCategory: "श्रेणी",
  memoryDescription: "टिप्पणी",
  memoryPhoto: "तस्वीर",
  memoryUseInActivities: "स्मरण गतिविधियों में इस्तेमाल करें",
  noMemories: "अभी कोई याद नहीं।",

  remindersTitle: "{name} के लिए याद दिलाने वाली बातें",
  remindersHelp:
    "{name} की रोज़ की दिनचर्या। याद दिलाना एक सुझाव है, आदेश नहीं — कॉग्निसारथी यह नहीं जान सकता कि कुछ सचमुच हुआ या नहीं, और यह कभी ऐसा दावा भी नहीं करता।",
  addReminder: "याद दिलाने वाली बात जोड़ें",
  reminderTitleField: "शीर्षक",
  reminderDescription: "टिप्पणी",
  reminderCategory: "श्रेणी",
  reminderTime: "समय",
  reminderRepeat: "दोहराव",
  reminderPriority: "महत्व",
  reminderStartDate: "शुरू",
  reminderEndDate: "समाप्त",
  reminderEnabled: "चालू",
  noReminders: "अभी कोई याद दिलाने वाली बात नहीं।",

  summaryTitle: "ब्यौरा",
  summaryToday: "आज",
  summaryThisWeek: "इस सप्ताह",
  summaryNotYetToday: "आज अभी नहीं",
  summaryCompleted: "पूरा हुआ",

  signInTitle: "साइन इन",
  signUpTitle: "खाता बनाएँ",
  fieldName: "आपका नाम",
  fieldEmail: "ईमेल",
  fieldPassword: "पासवर्ड",
  fieldConnectCode: "कनेक्शन कोड",
  connectCodeHelp:
    "अपने परिजन से कहिए कि वे अपनी प्रोफ़ाइल स्क्रीन पर दिख रहा कोड पढ़कर सुनाएँ।",
  fieldRelationship: "उनसे आपका रिश्ता",
  haveAccount: "पहले से खाता है?",
  needAccount: "खाता चाहिए?",

  updatedAt: "{time} बजे अपडेट हुआ",
  offlineNotice: "आप ऑफ़लाइन हैं। ये आँकड़े पुराने हो सकते हैं।",
  openSavedView: "सहेजा हुआ दृश्य खोलें",
  savedViewTitle: "सहेजा हुआ दृश्य",
  savedViewReadOnly:
    "यह इस डिवाइस पर सहेजी गई एक प्रति है। ऑनलाइन लौटने तक आप कोई बदलाव नहीं कर सकते।",

  difficultyEasy: "आसान",
  difficultyMedium: "मध्यम",
  difficultyHard: "कठिन",
  statusCompleted: "पूरा हुआ",
  statusNotFinished: "अधूरा",

  suggestedTitle: "आज {name} के लिए सुझाव",
  suggestedGentler:
    "आज की योजना जान-बूझकर छोटी रखी गई है — या तो हाल की गतिविधियाँ मेहनत भरी रहीं, या पिछली गतिविधि के बाद कुछ अंतराल रहा, इसलिए कॉग्निसारथी ज़्यादा नहीं, कम माँग रहा है।",
  suggestedAllDone: "{name} ने आज की सुझाई गई गतिविधियाँ पूरी कर ली हैं।",
  suggestedOpensAtEasy: "आसान स्तर पर शुरू होगी।",
  suggestedOpensAtMedium: "मध्यम स्तर पर शुरू होगी।",
  suggestedOpensAtHard: "कठिन स्तर पर शुरू होगी।",
  suggestedOptionalExtra:
    "अगर {name} और करना चाहें तो एक वैकल्पिक अतिरिक्त गतिविधि दी जाती है। इसे कभी ज़रूरी नहीं बताया जाता।",

  explainerTitle: "कॉग्निसारथी गतिविधियाँ कैसे अनुकूलित करता है",
  explainerPoint1:
    "यह देखता है कि हाल की गतिविधियाँ कैसी रहीं — कितने उत्तर सही थे।",
  explainerPoint2:
    "यह उत्तर देने में लगे समय और परिणामों की स्थिरता को ध्यान में रखता है।",
  explainerPoint3:
    "यह अगली गतिविधि का स्तर धीरे-धीरे, एक-एक कदम बदलता है।",
  explainerPoint4:
    "जो क्षेत्र ज़्यादा चुनौतीपूर्ण रहे हैं, उनमें थोड़ा और अभ्यास सुझाता है।",
  explainerPoint5:
    "यह किसी भी चिकित्सकीय स्थिति का निदान नहीं करता, और ये अंक कोई चिकित्सकीय माप नहीं हैं।",


  // --- Phase 8: Memory Lane ---
  navMemoryLane: "यादों की गली",
  memoryLaneTitle: "{name} की यादों का सिलसिला",
  memoryLaneHelp:
    "{name} की यादें, यादों की गली के अभ्यास-क्रम में कहाँ तक पहुँची हैं। तस्वीर पहचान लेने पर अगली बार दिखाने का अंतराल बढ़ जाता है; न पहचानने पर घट जाता है। ये सिर्फ़ अभ्यास-क्रम के नाम हैं — न याददाश्त की कोई माप, न कोई स्वास्थ्य आकलन।",
  memoryLaneEmpty: "अभी किसी याद का अभ्यास नहीं हुआ है।",
  memoryLaneEmptyHelp:
    "आप कोई याद जोड़ें और {name} यादों की गली खोलें — फिर उसका ब्यौरा यहाँ दिखेगा।",
  memoryLaneNotEnabled: "गतिविधियों में शामिल नहीं",
  memoryLaneNotMedical:
    "यादों की गली एक अभ्यास-क्रम है, कोई आकलन नहीं। ऊपर दिए नाम सिर्फ़ यह बताते हैं कि कोई याद दोबारा कब दिखाई जाएगी — यहाँ कुछ भी किसी की याददाश्त नहीं नापता और न ही उनके स्वास्थ्य के बारे में कुछ कहता है।",
  retentionNEW: "शुरू नहीं हुआ",
  retentionLEARNING: "सीख रहे हैं",
  retentionBUILDING: "बन रहा है",
  retentionHOLDING: "टिका हुआ है",
  retentionNEEDS_REINFORCEMENT: "और अभ्यास चाहिए",
  retentionNEWHelp: "यह अभी तक सामने नहीं आई।",
  retentionLEARNINGHelp: "एक ही बैठक में बार-बार दिखाई जा रही है।",
  retentionBUILDINGHelp: "अंतराल अब बढ़ने लगे हैं।",
  retentionHOLDINGHelp: "हफ़्ते भर या उससे ज़्यादा बाद भी पहचानी गई।",
  retentionNEEDS_REINFORCEMENTHelp:
    "हाल में मदद की ज़रूरत पड़ी, इसलिए अब यह फिर से जल्दी-जल्दी दिखाई जा रही है।",
  outcomeRECOGNISED: "पहचान लिया",
  outcomeASSISTED: "हमने जवाब दिखाया",
  outcomeNOT_RECOGNISED: "मदद की ज़रूरत पड़ी",
  outcomeSKIPPED: "आगे बढ़ गए",
  memoryLaneNextDue: "अगली बार: {when}",
  memoryLaneDueNow: "अभी तैयार",
  memoryLaneNoHistory: "अभी अभ्यास नहीं हुआ",
  memoryLaneStatus: "स्थिति",
  intervalSeconds: "{n} सेकंड",
  intervalMinutes: "{n} मिनट",
  intervalOneMinute: "1 मिनट",
  intervalDays: "{n} दिन",
  intervalOneDay: "1 दिन",

  voiceTitle: "जानी-पहचानी आवाज़",
  voiceHelp:
    "खुद बोलकर बताइए कि यह कौन है — \u201cमाँ, यह मीरा है।\u201d जवाब न आने पर यादों की गली यही सुनाती है। रिकॉर्डिंग तस्वीर की तरह निजी तौर पर रखी जाती है।",
  voiceRecord: "रिकॉर्ड करें",
  voiceStop: "रोकें",
  voicePlay: "सुनें",
  voiceDelete: "रिकॉर्डिंग हटाएँ",
  voiceReplace: "दोबारा रिकॉर्ड करें",
  voiceSaved: "रिकॉर्डिंग सहेज ली",
  voiceRecording: "रिकॉर्ड हो रहा है\u2026",
  voiceNone: "अभी कोई रिकॉर्डिंग नहीं",
  voiceHas: "रिकॉर्ड किया हुआ",
  voiceUnsupported:
    "यह ब्राउज़र आवाज़ रिकॉर्ड नहीं कर सकता। फ़ोन पर Chrome या Safari आज़माइए।",
  voiceDenied:
    "कॉग्निसारथी को माइक्रोफ़ोन इस्तेमाल करने की अनुमति नहीं मिली। आप ब्राउज़र सेटिंग में अनुमति दे सकते हैं।",
  voiceTooLong: "यह रिकॉर्डिंग बहुत लंबी है। एक मिनट से कम रखिए।",
  voiceSaveFailed: "यह रिकॉर्डिंग सहेजी नहीं जा सकी। कृपया फिर कोशिश कीजिए।",
  voiceDeleteConfirm: "यह रिकॉर्डिंग हटा दें?",

  memoryEditTitle: "याद बदलें",
  memoryNameField: "नाम",
  memoryRelationship: "रिश्ता",
  memoryRelationshipPlaceholder: "जैसे बेटी",
  memoryNoteOptional: "छोटी टिप्पणी (वैकल्पिक)",
  memoryPhotoOptional: "तस्वीर (वैकल्पिक)",
  memoryPhotoHelp: "JPG, PNG या WebP, 5 MB तक। निजी तौर पर रखी जाती है।",
  memoryAvailable: "याद वाली गतिविधियों में उपलब्ध",
  memoryHidden: "गतिविधियों से छिपी हुई",
  memorySave: "याद सहेजें",
  memoryDeleteConfirm: "\u201c{title}\u201d हटा दें? यह वापस नहीं आएगी।",
  memoryNeedsTitle: "कृपया इस याद को कोई नाम या शीर्षक दीजिए।",
  memoryNoneYet:
    "अभी कोई याद नहीं है। शुरुआत के लिए कोई परिजन या पसंदीदा जगह जोड़िए।",
  memoryCatPERSON: "व्यक्ति",
  memoryCatPLACE: "जगह",
  memoryCatTHING: "चीज़",
  memoryCatMOMENT: "पल",
  errorImageType:
    "यह तस्वीर का प्रकार समर्थित नहीं है। JPG, PNG या WebP इस्तेमाल कीजिए।",
  errorImageSize: "यह तस्वीर बहुत बड़ी है। 5 MB से छोटी इस्तेमाल कीजिए।",
  errorNoLinkedUser: "आपके खाते से जुड़ा कोई परिजन नहीं मिला।",
  generatedCopyEnglishNote:
    "कॉग्निसारथी की अपनी व्याख्याएँ और सूचना-पाठ फ़िलहाल अंग्रेज़ी में लिखे जाते हैं।",
};

const as: Partial<CaregiverDict> = {
  caregiverLabel: "যত্ন লওঁতা",
  navSections: "যত্ন লওঁতাৰ অংশ",
  navOverview: "সাৰাংশ",
  navReminders: "মনত পেলোৱা",
  navAlerts: "জাননী",
  navNotes: "টোকা",
  navSummary: "বিৱৰণ",
  navMemories: "স্মৃতি",
  navSettings: "ছেটিং",
  signOut: "ছাইন আউট",
  backToDashboard: "ডেশ্ববৰ্ডলৈ উভতি যাওক",

  save: "সাঁচি থওক",
  saving: "সাঁচি থোৱা হৈ আছে…",
  saved: "সাঁচি থোৱা হ'ল",
  cancel: "বাতিল কৰক",
  add: "যোগ কৰক",
  edit: "সলনি কৰক",
  remove: "আঁতৰাওক",
  manage: "চম্ভালক",
  close: "বন্ধ কৰক",
  somethingWentWrong: "কিবা এটা ভুল হ'ল। অনুগ্ৰহ কৰি আকৌ চেষ্টা কৰক।",

  notConnectedTitle: "এতিয়াও আপোনাৰ একাউণ্টৰ সৈতে কোনো সংযুক্ত হোৱা নাই।",
  notConnectedOverview:
    "আপোনাৰ পৰিয়ালৰ মানুহজনক কওক যে তেওঁ কগনিসাৰথীত নিজৰ প্ৰ'ফাইল খোলক আৰু সংযোগ ক'ডটো পঢ়ি শুনাওক, তাৰ পিছত সেই ক'ডেৰে পুনৰ ছাইন আপ কৰক।",
  notConnectedAlerts:
    "সংযুক্ত হোৱাৰ পিছত, তেওঁৰ দিনটোৰ গুৰুত্বপূৰ্ণ কথাবোৰ ইয়াত দেখা যাব।",
  notConnectedSettings:
    "তেওঁৰ মনত পেলোৱা, সম্পৰ্ক আৰু আপোনাৰ জাননী ছেটিং চম্ভালিবলৈ পৰিয়ালৰ কাৰোবাৰ সৈতে সংযুক্ত হওক।",
  notConnectedNotes:
    "প্ৰথমে পৰিয়ালৰ কাৰোবাৰ সৈতে সংযুক্ত হওক, তাৰ পিছত আপুনি তেওঁৰ বিষয়ে টোকা ৰাখিব পাৰিব।",
  notConnectedMemories:
    "প্ৰথমে পৰিয়ালৰ কাৰোবাৰ সৈতে সংযুক্ত হওক, তাৰ পিছত আপুনি তেওঁৰ বাবে স্মৃতি যোগ কৰিব পাৰিব।",
  notConnectedReminders:
    "প্ৰথমে পৰিয়ালৰ কাৰোবাৰ সৈতে সংযুক্ত হওক, তাৰ পিছত আপুনি তেওঁৰ বাবে মনত পেলোৱা সাজিব পাৰিব।",
  notConnectedSummary:
    "সংযুক্ত হোৱাৰ পিছত, ইয়াত দৈনিক আৰু সাপ্তাহিক বিৱৰণ দেখা যাব।",

  latestActivity: "শেহতীয়া কাম",
  noActivitiesYet: "এতিয়ালৈকে কোনো কাম লিপিবদ্ধ হোৱা নাই।",
  todaysOverview: "আজিৰ সাৰাংশ",
  tileActivities: "কামবোৰ",
  tileActivitiesHint: "আজি সম্পূৰ্ণ হ'ল",
  tileReminders: "মনত পেলোৱা",
  tileRemindersHint: "আজি গ্ৰহণ কৰা হ'ল",
  tileRemindersNone: "একো নাই",
  tileAverageScore: "গড় নম্বৰ",
  tileAverageScoreHint: "শেহতীয়া ১০টা কাম",
  needsAttention: "মনোযোগ দিয়া উচিত",
  allAlerts: "সকলো জাননী",
  nothingNeedsAttention: "এই মুহূৰ্তত আপোনাৰ মনোযোগৰ প্ৰয়োজন নাই।",
  memoryBank: "স্মৃতিৰ ভঁৰাল",
  memoryBankHint: "{name}ৰ মনত ৰাখিবলৈ মানুহ, ঠাই আৰু মুহূৰ্ত যোগ কৰক।",
  recentActivities: "শেহতীয়া কামবোৰ",
  nothingToShowYet: "এতিয়ালৈকে দেখুৱাবলৈ একো নাই।",
  noActivityStarted:
    "{name}এ এতিয়াও কোনো কাম আৰম্ভ কৰা নাই। তেওঁ কৰাৰ লগে লগে নম্বৰবোৰ ইয়াত দেখা যাব।",
  recentActivitiesCaption: "{name}এ শেহতীয়াকৈ সম্পূৰ্ণ কৰা কামবোৰ",
  colActivity: "কাম",
  colLevel: "স্তৰ",
  colScore: "নম্বৰ",
  colTime: "সময়",
  colWhen: "কেতিয়া",
  colStatus: "অৱস্থা",

  notMedicalNotice:
    "এই নম্বৰবোৰে কেৱল কামবোৰ কেনেদৰে হ'ল সেয়াহে বুজায়, ইয়াতকৈ বেছি একো নহয়। এইবোৰ কোনো চিকিৎসাৰ জোখ নহয় আৰু ইয়াক অৱনতি বা উন্নতিৰ লক্ষণ বুলি ভাবিব নালাগে।",

  alertsTitle: "জাননী",
  filterAll: "সকলো",
  filterUnread: "নপঢ়া",
  filterImportant: "গুৰুত্বপূৰ্ণ",
  filterResolved: "নিষ্পত্তি হোৱা",
  markRead: "পঢ়া বুলি চিহ্নিত কৰক",
  markResolved: "নিষ্পত্তি হোৱা বুলি চিহ্নিত কৰক",
  dismiss: "আঁতৰাওক",
  noAlerts: "দেখুৱাবলৈ কোনো জাননী নাই।",
  noAlertsBody: "দিনটোৰ বিষয়ে কথা থাকিলে ইয়াত দেখা যাব।",
  alertsHeading: "আপোনাৰ মনোযোগ প্ৰয়োজন",
  alertsEmptyTitle: "এই মুহূৰ্তত ইয়াত একো নাই।",
  alertsEmptyBody: "সাধাৰণতে এয়া ভাল খবৰ।",
  severityImportant: "গুৰুত্বপূৰ্ণ",
  severityAttention: "মনোযোগ দিয়ক",
  severityInfo: "তথ্য",
  statusUnread: "নপঢ়া",
  statusResolved: "নিষ্পত্তি হ'ল",
  actionMarkRead: "পঢ়া বুলি চিহ্নিত কৰক",
  actionResolve: "নিষ্পত্তি কৰক",
  actionDismiss: "আঁতৰাওক",
  alertsNotMedicalNotice:
    "এইবোৰ কাম আৰু মনত পেলোৱাৰ পৰা অহা মৃদু সংকেত। এইবোৰ কোনো চিকিৎসাৰ জোখ নহয় আৰু কেতিয়াও ৰোগ নিৰ্ণয় নহয়।",

  settingsTitle: "ছেটিং",
  settingsLanguage: "ডেশ্ববৰ্ডৰ ভাষা",
  settingsLanguageHelp:
    "আপুনি এই ডেশ্ববৰ্ডখন যি ভাষাত পঢ়ে। ইয়াৰ দ্বাৰা {name}এ নিজৰ ডিভাইচত যি দেখে সেয়া সলনি নহয়।",
  settingsNotifications: "জাননী",
  settingsNotificationsHelp: "আপুনি কিহৰ বিষয়ে জানিব বিচাৰে।",
  prefReminderNotifications: "মনত পেলোৱাৰ খবৰ",
  prefCognitiveActivityReminders: "কামৰ মনত পেলোৱা",
  prefAlertNotifications: "জাননী",
  prefWeeklySummary: "সাপ্তাহিক বিৱৰণ",
  settingsTimeZone: "সময় অঞ্চল",
  settingsTimeZoneHelp:
    "{name}ৰ বাবে মনত পেলোৱাবোৰ এই সময় অঞ্চল অনুসৰি নিৰ্ধাৰণ কৰা হয়।",
  emergencyTitle: "জৰুৰীকালীন সম্পৰ্ক",
  emergencyHelp:
    "{name}এ নিজৰ সহায় পৰ্দাৰ পৰা যিসকলক মাতিব পাৰে। কগনিসাৰথীয়ে কেৱল নম্বৰটো মিলায়, ইয়াতকৈ বেছি একো নকৰে — ই কেতিয়াও কাৰোবাৰ হৈ জৰুৰীকালীন সেৱালৈ ফোন নকৰে।",
  contactName: "নাম",
  contactPhone: "ফোন নম্বৰ",
  contactRelationship: "সম্পৰ্ক",
  noContacts: "এতিয়ালৈকে কোনো সম্পৰ্ক নাই।",
  emergencyOneTap:
    "{name}এ নিজৰ সহায় পৰ্দাৰ পৰা এবাৰ স্পৰ্শ কৰিয়েই এওঁলোকক মাতিব পাৰে।",
  memoryBankSubtitle:
    "যিবোৰ মানুহ, ঠাই আৰু মুহূৰ্ত মনত পেলাবলৈ {name}এ ভাল পাব পাৰে।",
  settingsNotificationsInApp:
    "এইবোৰে ঠিক কৰে আপুনি কগনিসাৰথীত কি দেখিব। সকলো খবৰ এপৰ ভিতৰতে — এই সংস্কৰণত কগনিসাৰথীয়ে পুচ, ইমেইল বা এছএমএছ নপঠিয়ায়।",
  prefReminderHelp: "আপোনাৰ পৰিয়ালৰ মানুহজনৰ মনত পেলোৱাৰ কাম দেখুৱাওক।",
  prefActivityHelp: "দৈনন্দিন কামৰ ফালে মৃদু ইংগিত অন্তৰ্ভুক্ত কৰক।",
  prefAlertsHelp: "জাননী কেন্দ্ৰত গুৰুত্বপূৰ্ণ কথাবোৰ দেখুৱাওক।",
  prefWeeklyHelp: "কগনিসাৰথীৰ সাপ্তাহিক বিৱৰণ চালু কৰি ৰাখক।",
  settingsTimeZoneTitle: "{name}ৰ সময় অঞ্চল",
  settingsTimeZoneBody:
    "মনত পেলোৱাবোৰ এই সময় অঞ্চল অনুসৰি নিৰ্ধাৰণ কৰা হয়, যাতে ০৮:০০ বজাৰ মনত পেলোৱাটো {name} য'ত আছে তাত ০৮:০০ বজাতেই থাকে।",
  languageChangesOnlyYours:
    "ইয়াৰ দ্বাৰা কেৱল আপোনাৰ নিজৰ ডেশ্ববৰ্ডহে সলনি হয়। {name}ৰ ডিভাইচৰ ভাষা সলনি নহয়।",

  notesTitle: "{name}ৰ বিষয়ে টোকা",
  notesHelp:
    "আপোনাৰ আৰু {name}ৰ যত্ন লোৱা আন সকলোৰে বাবে চুটি চুটি কথা। এইবোৰ {name}ক কেতিয়াও দেখুওৱা নহয়, আৰু কেতিয়াও কোনো চিকিৎসাৰ সিদ্ধান্তলৈ সলনি কৰা নহয়।",
  addNote: "টোকা যোগ কৰক",
  noteBody: "টোকা",
  noteCategory: "শ্ৰেণী",
  noNotes: "এতিয়ালৈকে কোনো টোকা নাই।",
  noteByYou: "আপুনি",

  memoriesTitle: "{name}ৰ স্মৃতি",
  memoriesHelp:
    "ইয়াত আপুনি যি যোগ কৰিব সেয়া {name}ৰ স্মৃতি পৃষ্ঠাত দেখা যাব পাৰে আৰু, আপুনি অনুমতি দিলে, মৃদু স্মৰণ কামবোৰতো। এইবোৰ কেৱল আপুনি আৰু {name}হে চাব পাৰে — ফটোবোৰ ব্যক্তিগতভাৱে ৰখা হয়।",
  addMemory: "স্মৃতি যোগ কৰক",
  memoryTitleField: "শিৰোনাম",
  memoryCategory: "শ্ৰেণী",
  memoryDescription: "টোকা",
  memoryPhoto: "ফটো",
  memoryUseInActivities: "স্মৰণ কামত ব্যৱহাৰ কৰক",
  noMemories: "এতিয়ালৈকে কোনো স্মৃতি নাই।",

  remindersTitle: "{name}ৰ বাবে মনত পেলোৱা",
  remindersHelp:
    "{name}এ অনুসৰণ কৰা দৈনন্দিন ৰুটিন। মনত পেলোৱাটো এটা আহ্বান, আদেশ নহয় — কগনিসাৰথীয়ে জানিব নোৱাৰে যে কিবা সঁচাকৈ কৰা হ'ল নে নাই, আৰু ই কেতিয়াও তেনে দাবীও নকৰে।",
  addReminder: "মনত পেলোৱা যোগ কৰক",
  reminderTitleField: "শিৰোনাম",
  reminderDescription: "টোকা",
  reminderCategory: "শ্ৰেণী",
  reminderTime: "সময়",
  reminderRepeat: "পুনৰাবৃত্তি",
  reminderPriority: "গুৰুত্ব",
  reminderStartDate: "আৰম্ভ",
  reminderEndDate: "সমাপ্ত",
  reminderEnabled: "সক্ৰিয়",
  noReminders: "এতিয়ালৈকে কোনো মনত পেলোৱা নাই।",

  summaryTitle: "বিৱৰণ",
  summaryToday: "আজি",
  summaryThisWeek: "এই সপ্তাহত",
  summaryNotYetToday: "আজি এতিয়াও নহয়",
  summaryCompleted: "সম্পূৰ্ণ হ'ল",

  signInTitle: "ছাইন ইন",
  signUpTitle: "একাউণ্ট সাজক",
  fieldName: "আপোনাৰ নাম",
  fieldEmail: "ইমেইল",
  fieldPassword: "পাছৱৰ্ড",
  fieldConnectCode: "সংযোগ ক'ড",
  connectCodeHelp:
    "আপোনাৰ পৰিয়ালৰ মানুহজনক কওক যে তেওঁ নিজৰ প্ৰ'ফাইল পৰ্দাত থকা ক'ডটো পঢ়ি শুনাওক।",
  fieldRelationship: "তেওঁৰ সৈতে আপোনাৰ সম্পৰ্ক",
  haveAccount: "আগৰ পৰাই একাউণ্ট আছে নেকি?",
  needAccount: "একাউণ্ট লাগে নেকি?",

  updatedAt: "{time} বজাত আপডেট হ'ল",
  offlineNotice: "আপুনি অফলাইন আছে। এই তথ্যবোৰ পুৰণি হ'ব পাৰে।",
  openSavedView: "সাঁচি থোৱা দৃশ্য খোলক",
  savedViewTitle: "সাঁচি থোৱা দৃশ্য",
  savedViewReadOnly:
    "এইটো এই ডিভাইচত সাঁচি থোৱা এটা প্ৰতিলিপি। অনলাইনলৈ নহালৈকে আপুনি কোনো সালসলনি কৰিব নোৱাৰে।",

  difficultyEasy: "সহজ",
  difficultyMedium: "মধ্যম",
  difficultyHard: "কঠিন",
  statusCompleted: "সম্পূৰ্ণ হ'ল",
  statusNotFinished: "সম্পূৰ্ণ নহ'ল",

  suggestedTitle: "আজি {name}ৰ বাবে পৰামৰ্শ",
  suggestedGentler:
    "আজিৰ পৰিকল্পনা ইচ্ছাকৃতভাৱে চুটি — হয় শেহতীয়া কামবোৰ কষ্টকৰ আছিল, নহয় যোৱাবাৰৰ পিছত কিছু ব্যৱধান হৈছে, সেয়েহে কগনিসাৰথীয়ে বেছি নহয়, কমকৈ বিচাৰিছে।",
  suggestedAllDone: "{name}এ আজিৰ পৰামৰ্শ দিয়া কামবোৰ সম্পূৰ্ণ কৰিছে।",
  suggestedOpensAtEasy: "সহজ স্তৰত আৰম্ভ হ'ব।",
  suggestedOpensAtMedium: "মধ্যম স্তৰত আৰম্ভ হ'ব।",
  suggestedOpensAtHard: "কঠিন স্তৰত আৰম্ভ হ'ব।",
  suggestedOptionalExtra:
    "{name}এ আৰু কৰিব বিচাৰিলে এটা বৈকল্পিক অতিৰিক্ত কাম দিয়া হয়। ইয়াক কেতিয়াও বাধ্যতামূলক বুলি কোৱা নহয়।",

  explainerTitle: "কগনিসাৰথীয়ে কামবোৰ কেনেকৈ ব্যক্তিগত কৰে",
  explainerPoint1:
    "ই চায় যে শেহতীয়া কামবোৰ কেনে হ'ল — কিমান উত্তৰ শুদ্ধ আছিল।",
  explainerPoint2:
    "ই উত্তৰ দিবলৈ লগা সময় আৰু ফলাফলবোৰ কিমান স্থিৰ আছিল সেয়া বিবেচনা কৰে।",
  explainerPoint3:
    "ই পৰৱৰ্তী কামৰ স্তৰ লাহে লাহে, এখোজ এখোজকৈ সলনি কৰে।",
  explainerPoint4:
    "যিবোৰ ক্ষেত্ৰ অধিক কঠিন আছিল, তাত অলপ বেছি অভ্যাসৰ পৰামৰ্শ দিয়ে।",
  explainerPoint5:
    "ই কোনো চিকিৎসাজনিত অৱস্থা নিৰ্ণয় নকৰে, আৰু এই নম্বৰবোৰ কোনো চিকিৎসাৰ জোখ নহয়।",


  // --- Phase 8: Memory Lane ---
  navMemoryLane: "স্মৃতিৰ বাট",
  memoryLaneTitle: "{name}ৰ স্মৃতিৰ ধাৰাবাহিকতা",
  memoryLaneHelp:
    "{name}ৰ স্মৃতিবোৰ স্মৃতিৰ বাটৰ অভ্যাস-সূচীত ক\u2019ত আছে। ফটো এখন চিনি পালে পিছৰবাৰ দেখুৱাৰ ব্যৱধান বাঢ়ে; নাপালে কমে। এইবোৰ কেৱল অভ্যাস-সূচীৰ নাম — স্মৃতিৰ জোখ বা স্বাস্থ্যৰ মূল্যায়ন নহয়।",
  memoryLaneEmpty: "এতিয়ালৈকে কোনো স্মৃতিৰ অভ্যাস হোৱা নাই।",
  memoryLaneEmptyHelp:
    "আপুনি এটা স্মৃতি যোগ কৰক আৰু {name}এ স্মৃতিৰ বাট খোলক — তাৰ পিছত ইয়াত ইয়াৰ ইতিহাস দেখা যাব।",
  memoryLaneNotEnabled: "কামত ব্যৱহাৰ কৰা হোৱা নাই",
  memoryLaneNotMedical:
    "স্মৃতিৰ বাট এটা অভ্যাস-সূচী, কোনো মূল্যায়ন নহয়। ওপৰৰ নামবোৰে কেৱল কয় যে এটা স্মৃতি পুনৰ কেতিয়া দেখুওৱা হ\u2019ব — ইয়াত একোৱেই কাৰোবাৰ স্মৃতি নজোখে বা তেওঁলোকৰ স্বাস্থ্যৰ বিষয়ে একো নকয়।",
  retentionNEW: "আৰম্ভ হোৱা নাই",
  retentionLEARNING: "শিকি আছে",
  retentionBUILDING: "গঢ় লৈ আছে",
  retentionHOLDING: "ধৰি ৰাখিছে",
  retentionNEEDS_REINFORCEMENT: "আৰু অভ্যাস লাগে",
  retentionNEWHelp: "এইটো এতিয়ালৈকে ওলোৱা নাই।",
  retentionLEARNINGHelp: "একে বহাতে বাৰে বাৰে দেখুওৱা হৈ আছে।",
  retentionBUILDINGHelp: "ব্যৱধানবোৰ এতিয়া বাঢ়িবলৈ ধৰিছে।",
  retentionHOLDINGHelp: "এসপ্তাহ বা তাতোকৈ বেছি পিছতো চিনি পাইছে।",
  retentionNEEDS_REINFORCEMENTHelp:
    "শেহতীয়াকৈ সহায় লাগিছিল, সেয়েহে এতিয়া পুনৰ সঘনাই দেখুওৱা হৈ আছে।",
  outcomeRECOGNISED: "চিনি পালে",
  outcomeASSISTED: "আমি উত্তৰটো দেখুৱালোঁ",
  outcomeNOT_RECOGNISED: "সহায় লাগিছিল",
  outcomeSKIPPED: "আগবাঢ়িল",
  memoryLaneNextDue: "পিছৰবাৰ: {when}",
  memoryLaneDueNow: "এতিয়াই সাজু",
  memoryLaneNoHistory: "এতিয়ালৈকে অভ্যাস হোৱা নাই",
  memoryLaneStatus: "অৱস্থা",
  intervalSeconds: "{n} ছেকেণ্ড",
  intervalMinutes: "{n} মিনিট",
  intervalOneMinute: "1 মিনিট",
  intervalDays: "{n} দিন",
  intervalOneDay: "1 দিন",

  voiceTitle: "চিনাকি মাত",
  voiceHelp:
    "নিজে ক\u2019য়ে দিয়ক এওঁ কোন — \u201cমা, এওঁ মীৰা।\u201d উত্তৰ নাহিলে স্মৃতিৰ বাটে এইটোৱেই বজায়। ৰেকৰ্ডিং ফটোৰ দৰেই ব্যক্তিগতভাৱে ৰখা হয়।",
  voiceRecord: "ৰেকৰ্ড কৰক",
  voiceStop: "বন্ধ কৰক",
  voicePlay: "শুনক",
  voiceDelete: "ৰেকৰ্ডিং আঁতৰাওক",
  voiceReplace: "পুনৰ ৰেকৰ্ড কৰক",
  voiceSaved: "ৰেকৰ্ডিং সাঁচি থোৱা হ\u2019ল",
  voiceRecording: "ৰেকৰ্ড হৈ আছে\u2026",
  voiceNone: "এতিয়ালৈকে ৰেকৰ্ডিং নাই",
  voiceHas: "ৰেকৰ্ড কৰা আছে",
  voiceUnsupported:
    "এই ব্ৰাউজাৰে মাত ৰেকৰ্ড কৰিব নোৱাৰে। ফোনত Chrome বা Safari চেষ্টা কৰক।",
  voiceDenied:
    "কগনিসাৰথীয়ে মাইক্ৰ\u2019ফোন ব্যৱহাৰ কৰাৰ অনুমতি পোৱা নাই। ব্ৰাউজাৰ ছেটিংছত অনুমতি দিব পাৰে।",
  voiceTooLong: "এই ৰেকৰ্ডিংটো বহুত দীঘল। এক মিনিটতকৈ কম ৰাখক।",
  voiceSaveFailed: "এই ৰেকৰ্ডিংটো সাঁচি থ\u2019ব পৰা নগ\u2019ল। অনুগ্ৰহ কৰি আকৌ চেষ্টা কৰক।",
  voiceDeleteConfirm: "এই ৰেকৰ্ডিংটো আঁতৰাব নে?",

  memoryEditTitle: "স্মৃতি সলনি কৰক",
  memoryNameField: "নাম",
  memoryRelationship: "সম্পৰ্ক",
  memoryRelationshipPlaceholder: "যেনে, ছোৱালী",
  memoryNoteOptional: "চুটি টোকা (বিকল্প)",
  memoryPhotoOptional: "ফটো (বিকল্প)",
  memoryPhotoHelp: "JPG, PNG বা WebP, 5 MB লৈকে। ব্যক্তিগতভাৱে ৰখা হয়।",
  memoryAvailable: "স্মৃতিৰ কামত উপলব্ধ",
  memoryHidden: "কামৰ পৰা লুকুৱা",
  memorySave: "স্মৃতি সাঁচি থওক",
  memoryDeleteConfirm: "\u201c{title}\u201d আঁতৰাব নে? ইয়াক ঘূৰাই পোৱা নাযাব।",
  memoryNeedsTitle: "অনুগ্ৰহ কৰি এই স্মৃতিটোক এটা নাম বা শিৰোনাম দিয়ক।",
  memoryNoneYet:
    "এতিয়ালৈকে কোনো স্মৃতি নাই। আৰম্ভ কৰিবলৈ এজন পৰিয়ালৰ মানুহ বা এখন প্ৰিয় ঠাই যোগ কৰক।",
  memoryCatPERSON: "মানুহ",
  memoryCatPLACE: "ঠাই",
  memoryCatTHING: "বস্তু",
  memoryCatMOMENT: "মুহূৰ্ত",
  errorImageType:
    "এই ধৰণৰ ফটো সমৰ্থিত নহয়। JPG, PNG বা WebP ব্যৱহাৰ কৰক।",
  errorImageSize: "এই ফটোখন বৰ ডাঙৰ। 5 MBতকৈ সৰু এখন ব্যৱহাৰ কৰক।",
  errorNoLinkedUser: "আপোনাৰ একাউণ্টৰ সৈতে জড়িত কোনো পৰিয়ালৰ মানুহ পোৱা নগ\u2019ল।",
  generatedCopyEnglishNote:
    "কগনিসাৰথীৰ নিজৰ ব্যাখ্যা আৰু জাননীৰ লিখনি এতিয়ালৈকে ইংৰাজীত লিখা হয়।",
};

const dictionaries: Record<Language, CaregiverDict> = {
  EN: en,
  HI: { ...en, ...hi },
  AS: { ...en, ...as },
};

export function getCaregiverDict(
  language: Language | undefined | null,
): CaregiverDict {
  return dictionaries[language ?? "EN"] ?? en;
}

/**
 * Substitute `{name}`-style placeholders.
 *
 * Kept as a helper rather than template literals in the components,
 * because word ORDER differs between these languages — "{name}'s
 * memories" and "{name}ৰ স্মৃতি" put the possessive in different
 * places, and only a placeholder inside the translated string can
 * express that. Concatenating in the component would silently force
 * English order onto every language.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result;
}
