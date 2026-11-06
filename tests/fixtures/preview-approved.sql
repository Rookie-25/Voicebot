-- PREVIEW ONLY: EXPLICITLY FICTIONAL SYNTHETIC DATA. No real candidate facts.
-- Reviewed subset of fictional-knowledge.sql: no draft/private/unapproved canaries.
-- Apply remotely ONLY after separate preview deployment authorization.
-- Standard variants deliberately reuse the same approved short wording.
PRAGMA foreign_keys = ON;
INSERT INTO candidates (id) VALUES ('fictional-alex');
INSERT INTO content_versions (candidate_id,id,state,synthetic) VALUES ('fictional-alex','fixture-v1','published',1);
INSERT INTO candidate_facts VALUES ('fictional-alex','fixture-v1','intro','background','SYNTHETIC FIXTURE: Alex is a fictional sample character for local protocol tests.',1,'public');
INSERT INTO projects VALUES ('fictional-alex','fixture-v1','sample-project','Fictional protocol garden','SYNTHETIC FIXTURE: a fictional project used only to exercise retrieval.',1,'public');
INSERT INTO interview_stories VALUES ('fictional-alex','fixture-v1','sample-story','Fictional teamwork story','SYNTHETIC FIXTURE: a made-up interview story, not real candidate history.',1,'public');
INSERT INTO evidence VALUES ('fictional-alex','fixture-v1','sample-evidence','Synthetic test source','SYNTHETIC FIXTURE: approved local test evidence for the fictional introduction.',1,'public');
INSERT INTO approved_answers VALUES ('fictional-alex','fixture-v1','intro','Fictional introduction','SYNTHETIC FIXTURE: a fictional introduction.',1,'public'),('fictional-alex','fixture-v1','followup','Fictional follow-up','SYNTHETIC FIXTURE: a short follow-up.',1,'public');
INSERT INTO answer_variants VALUES ('fictional-alex','fixture-v1','intro','short','SYNTHETIC FIXTURE: I am Alex, a fictional character used only for local MCP tests.',1),('fictional-alex','fixture-v1','intro','standard','SYNTHETIC FIXTURE: I am Alex, a fictional character used only for local MCP tests.',1),('fictional-alex','fixture-v1','followup','short','SYNTHETIC FIXTURE: this is a fictional follow-up answer.',1),('fictional-alex','fixture-v1','followup','standard','SYNTHETIC FIXTURE: this is a fictional follow-up answer.',1);
INSERT INTO answer_evidence VALUES ('fictional-alex','fixture-v1','intro','sample-evidence'),('fictional-alex','fixture-v1','followup','sample-evidence');
INSERT INTO answer_followups VALUES ('fictional-alex','fixture-v1','intro','followup');
