from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Claims(Base):
    __tablename__ = "claims"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    item_id = Column(Integer, nullable=False)
    message = Column(String, nullable=True)
    status = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)