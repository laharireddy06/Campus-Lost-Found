from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Items(Base):
    __tablename__ = "items"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=False)
    type = Column(String, nullable=False)
    images = Column(String, nullable=True)
    location = Column(String, nullable=True)
    status = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    contact_info = Column(String, nullable=True)
    reunited_at = Column(DateTime(timezone=True), nullable=True)
    reunited_by = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)