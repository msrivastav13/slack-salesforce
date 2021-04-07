
CREATE TABLE BotUser
(
  ID          text              NOT NULL,
  SCOPE       character varying,
  ACCESSTOKEN character varying,
  BOTUSERID   character varying,
  CREATEDDATE timestamptz      ,
  UPDATEDDATE timestamptz      ,
  WorkspaceID text             
);

COMMENT ON TABLE BotUser IS 'Slack creates a bot user on the workspace';

CREATE TABLE Enteprise
(
  ID          text        NOT NULL,
  NAME        text       ,
  CREATEDDATE timestamptz,
  UPDATEDDATE timestamptz,
  PRIMARY KEY (ID)
);

COMMENT ON TABLE Enteprise IS 'An enterprise in Slack is the central entity of Slack’s Enterprise grid plan.';

COMMENT ON COLUMN Enteprise.ID IS 'Unique across all of Slack';

CREATE TABLE GlobalUser
(
  ID                text        NOT NULL,
  SLACKGLOBALUSERID text       ,
  CREATEDDATE       timestamptz,
  UPDATEDDATE       timestamptz,
  ENTERPRISEID      text       ,
  PRIMARY KEY (ID)
);

COMMENT ON COLUMN GlobalUser.ENTERPRISEID IS 'Unique across all of Slack';

CREATE TABLE LocalUser
(
  ID           text        NOT NULL,
  LOCALUSERID  text       ,
  CREATEDDATE  timestamptz,
  UPDATEDDATE  timestamptz,
  WORKSPACEID  text       ,
  GLOBALUSERID text       ,
  PRIMARY KEY (ID)
);

COMMENT ON TABLE LocalUser IS 'Local User of the Slack';

CREATE TABLE WorkSpace
(
  ID             text        NOT NULL,
  NAME           text       ,
  ISAPPINSTALLED boolean     DEFAULT FALSE,
  CREATEDDATE    timestamptz,
  UPDATEDATE     timestamptz,
  ENTERPRISEID   text       ,
  PRIMARY KEY (ID)
);

COMMENT ON TABLE WorkSpace IS 'It’s a foundational Slack entity and many Slack entities strongly relate back to the workspace';

COMMENT ON COLUMN WorkSpace.ENTERPRISEID IS 'Unique across all of Slack';

ALTER TABLE WorkSpace
  ADD CONSTRAINT FK_Enteprise_TO_WorkSpace
    FOREIGN KEY (ENTERPRISEID)
    REFERENCES Enteprise (ID);

ALTER TABLE GlobalUser
  ADD CONSTRAINT FK_Enteprise_TO_GlobalUser
    FOREIGN KEY (ENTERPRISEID)
    REFERENCES Enteprise (ID);

ALTER TABLE BotUser
  ADD CONSTRAINT FK_WorkSpace_TO_BotUser
    FOREIGN KEY (WorkspaceID)
    REFERENCES WorkSpace (ID);

ALTER TABLE LocalUser
  ADD CONSTRAINT FK_WorkSpace_TO_LocalUser
    FOREIGN KEY (WORKSPACEID)
    REFERENCES WorkSpace (ID);

ALTER TABLE LocalUser
  ADD CONSTRAINT FK_GlobalUser_TO_LocalUser
    FOREIGN KEY (GLOBALUSERID)
    REFERENCES GlobalUser (ID);
