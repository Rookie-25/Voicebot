PRAGMA foreign_keys = ON;
CREATE TABLE candidates (id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 80));
CREATE TABLE content_versions (
 candidate_id TEXT NOT NULL REFERENCES candidates(id), id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('draft','published','revoked')),
 synthetic INTEGER NOT NULL CHECK(synthetic IN (0,1)),
 PRIMARY KEY(candidate_id,id)
);
CREATE TABLE candidate_facts (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, id TEXT NOT NULL,
 section TEXT NOT NULL CHECK(section IN ('background','strengths','working_style','goals')), statement TEXT NOT NULL CHECK(length(statement) BETWEEN 1 AND 600),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 PRIMARY KEY(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version) REFERENCES content_versions(candidate_id,id)
);
CREATE TABLE projects (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), summary TEXT NOT NULL CHECK(length(summary) <= 400),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 PRIMARY KEY(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version) REFERENCES content_versions(candidate_id,id)
);
CREATE TABLE interview_stories (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), summary TEXT NOT NULL CHECK(length(summary) <= 400),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 PRIMARY KEY(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version) REFERENCES content_versions(candidate_id,id)
);
CREATE TABLE evidence (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, id TEXT NOT NULL,
 source_label TEXT NOT NULL CHECK(length(source_label) BETWEEN 1 AND 120), excerpt TEXT NOT NULL CHECK(length(excerpt) BETWEEN 1 AND 400),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 PRIMARY KEY(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version) REFERENCES content_versions(candidate_id,id)
);
CREATE TABLE approved_answers (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, id TEXT NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120), summary TEXT NOT NULL CHECK(length(summary) <= 400),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 PRIMARY KEY(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version) REFERENCES content_versions(candidate_id,id)
);
CREATE TABLE answer_variants (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, answer_id TEXT NOT NULL,
 variant TEXT NOT NULL CHECK(variant IN ('short','standard')),
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 900),
 approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1)),
 PRIMARY KEY(candidate_id,version,answer_id,variant),
 FOREIGN KEY(candidate_id,version,answer_id) REFERENCES approved_answers(candidate_id,version,id)
);
CREATE TABLE answer_evidence (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, answer_id TEXT NOT NULL, evidence_id TEXT NOT NULL,
 PRIMARY KEY(candidate_id,version,answer_id,evidence_id),
 FOREIGN KEY(candidate_id,version,answer_id) REFERENCES approved_answers(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version,evidence_id) REFERENCES evidence(candidate_id,version,id)
);
CREATE TABLE answer_followups (
 candidate_id TEXT NOT NULL, version TEXT NOT NULL, answer_id TEXT NOT NULL, followup_id TEXT NOT NULL,
 PRIMARY KEY(candidate_id,version,answer_id,followup_id),
 FOREIGN KEY(candidate_id,version,answer_id) REFERENCES approved_answers(candidate_id,version,id),
 FOREIGN KEY(candidate_id,version,followup_id) REFERENCES approved_answers(candidate_id,version,id)
);
CREATE VIEW public_answers AS
 SELECT a.* FROM approved_answers a
 JOIN content_versions v ON v.candidate_id=a.candidate_id AND v.id=a.version
 WHERE a.approved=1 AND a.visibility='public' AND v.state='published'
 AND EXISTS(SELECT 1 FROM answer_variants t WHERE t.candidate_id=a.candidate_id AND t.version=a.version AND t.answer_id=a.id AND t.approved=1)
 AND EXISTS(SELECT 1 FROM answer_evidence l WHERE l.candidate_id=a.candidate_id AND l.version=a.version AND l.answer_id=a.id)
 AND NOT EXISTS(
   SELECT 1 FROM answer_evidence l JOIN evidence e ON e.candidate_id=l.candidate_id AND e.version=l.version AND e.id=l.evidence_id
   WHERE l.candidate_id=a.candidate_id AND l.version=a.version AND l.answer_id=a.id AND (e.approved<>1 OR e.visibility<>'public')
 );
CREATE VIEW public_knowledge AS
 SELECT candidate_id,version,id,'answer' AS kind,title,summary FROM public_answers
 UNION ALL SELECT p.candidate_id,p.version,p.id,'project',p.title,p.summary FROM projects p JOIN content_versions v ON v.candidate_id=p.candidate_id AND v.id=p.version WHERE p.approved=1 AND p.visibility='public' AND v.state='published'
 UNION ALL SELECT p.candidate_id,p.version,p.id,'story',p.title,p.summary FROM interview_stories p JOIN content_versions v ON v.candidate_id=p.candidate_id AND v.id=p.version WHERE p.approved=1 AND p.visibility='public' AND v.state='published'
 UNION ALL SELECT p.candidate_id,p.version,p.id,'evidence',p.source_label,p.excerpt FROM evidence p JOIN content_versions v ON v.candidate_id=p.candidate_id AND v.id=p.version WHERE p.approved=1 AND p.visibility='public' AND v.state='published';
