use std::cmp::Ordering;
use std::mem;



extern crate flatbuffers;
use self::flatbuffers::EndianScalar;

#[allow(unused_imports, dead_code)]
pub mod org {

    use std::cmp::Ordering;
    use std::mem;

    extern crate flatbuffers;
    use self::flatbuffers::EndianScalar;
    #[allow(unused_imports, dead_code)]
    pub mod enso {

        use std::cmp::Ordering;
        use std::mem;

        extern crate flatbuffers;
        use self::flatbuffers::EndianScalar;
        #[allow(unused_imports, dead_code)]
        pub mod languageserver {

            use std::cmp::Ordering;
            use std::mem;

            extern crate flatbuffers;
            use self::flatbuffers::EndianScalar;
            #[allow(unused_imports, dead_code)]
            pub mod protocol {

                use std::cmp::Ordering;
                use std::mem;

                extern crate flatbuffers;
                use self::flatbuffers::EndianScalar;
                #[allow(unused_imports, dead_code)]
                pub mod binary {

                    use std::cmp::Ordering;
                    use std::mem;

                    extern crate flatbuffers;
                    use self::flatbuffers::EndianScalar;

                    #[allow(non_camel_case_types)]
                    #[repr(u8)]
                    #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
                    pub enum InboundPayload {
                        NONE               = 0,
                        INIT_SESSION_CMD   = 1,
                        WRITE_FILE_CMD     = 2,
                        READ_FILE_CMD      = 3,
                        WRITE_BYTES_CMD    = 4,
                        READ_BYTES_CMD     = 5,
                        CHECKSUM_BYTES_CMD = 6,
                    }

                    pub const ENUM_MIN_INBOUND_PAYLOAD: u8 = 0;
                    pub const ENUM_MAX_INBOUND_PAYLOAD: u8 = 6;

                    impl<'a> flatbuffers::Follow<'a> for InboundPayload {
                        type Inner = Self;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            flatbuffers::read_scalar_at::<Self>(buf, loc)
                        }
                    }

                    impl flatbuffers::EndianScalar for InboundPayload {
                        #[inline]
                        fn to_little_endian(self) -> Self {
                            let n = u8::to_le(self as u8);
                            let p = &n as *const u8 as *const InboundPayload;
                            unsafe { *p }
                        }
                        #[inline]
                        fn from_little_endian(self) -> Self {
                            let n = u8::from_le(self as u8);
                            let p = &n as *const u8 as *const InboundPayload;
                            unsafe { *p }
                        }
                    }

                    impl flatbuffers::Push for InboundPayload {
                        type Output = InboundPayload;
                        #[inline]
                        fn push(&self, dst: &mut [u8], _rest: &[u8]) {
                            flatbuffers::emplace_scalar::<InboundPayload>(dst, *self);
                        }
                    }

                    #[allow(non_camel_case_types)]
                    pub const ENUM_VALUES_INBOUND_PAYLOAD: [InboundPayload; 7] = [
                        InboundPayload::NONE,
                        InboundPayload::INIT_SESSION_CMD,
                        InboundPayload::WRITE_FILE_CMD,
                        InboundPayload::READ_FILE_CMD,
                        InboundPayload::WRITE_BYTES_CMD,
                        InboundPayload::READ_BYTES_CMD,
                        InboundPayload::CHECKSUM_BYTES_CMD,
                    ];

                    #[allow(non_camel_case_types)]
                    pub const ENUM_NAMES_INBOUND_PAYLOAD: [&'static str; 7] = [
                        "NONE",
                        "INIT_SESSION_CMD",
                        "WRITE_FILE_CMD",
                        "READ_FILE_CMD",
                        "WRITE_BYTES_CMD",
                        "READ_BYTES_CMD",
                        "CHECKSUM_BYTES_CMD",
                    ];

                    pub fn enum_name_inbound_payload(e: InboundPayload) -> &'static str {
                        let index = e as u8;
                        ENUM_NAMES_INBOUND_PAYLOAD[index as usize]
                    }

                    pub struct InboundPayloadUnionTableOffset {}
                    #[allow(non_camel_case_types)]
                    #[repr(u8)]
                    #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
                    pub enum OutboundPayload {
                        NONE                 = 0,
                        ERROR                = 1,
                        SUCCESS              = 2,
                        VISUALISATION_UPDATE = 3,
                        FILE_CONTENTS_REPLY  = 4,
                        WRITE_BYTES_REPLY    = 5,
                        READ_BYTES_REPLY     = 6,
                        CHECKSUM_BYTES_REPLY = 7,
                    }

                    pub const ENUM_MIN_OUTBOUND_PAYLOAD: u8 = 0;
                    pub const ENUM_MAX_OUTBOUND_PAYLOAD: u8 = 7;

                    impl<'a> flatbuffers::Follow<'a> for OutboundPayload {
                        type Inner = Self;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            flatbuffers::read_scalar_at::<Self>(buf, loc)
                        }
                    }

                    impl flatbuffers::EndianScalar for OutboundPayload {
                        #[inline]
                        fn to_little_endian(self) -> Self {
                            let n = u8::to_le(self as u8);
                            let p = &n as *const u8 as *const OutboundPayload;
                            unsafe { *p }
                        }
                        #[inline]
                        fn from_little_endian(self) -> Self {
                            let n = u8::from_le(self as u8);
                            let p = &n as *const u8 as *const OutboundPayload;
                            unsafe { *p }
                        }
                    }

                    impl flatbuffers::Push for OutboundPayload {
                        type Output = OutboundPayload;
                        #[inline]
                        fn push(&self, dst: &mut [u8], _rest: &[u8]) {
                            flatbuffers::emplace_scalar::<OutboundPayload>(dst, *self);
                        }
                    }

                    #[allow(non_camel_case_types)]
                    pub const ENUM_VALUES_OUTBOUND_PAYLOAD: [OutboundPayload; 8] = [
                        OutboundPayload::NONE,
                        OutboundPayload::ERROR,
                        OutboundPayload::SUCCESS,
                        OutboundPayload::VISUALISATION_UPDATE,
                        OutboundPayload::FILE_CONTENTS_REPLY,
                        OutboundPayload::WRITE_BYTES_REPLY,
                        OutboundPayload::READ_BYTES_REPLY,
                        OutboundPayload::CHECKSUM_BYTES_REPLY,
                    ];

                    #[allow(non_camel_case_types)]
                    pub const ENUM_NAMES_OUTBOUND_PAYLOAD: [&'static str; 8] = [
                        "NONE",
                        "ERROR",
                        "SUCCESS",
                        "VISUALISATION_UPDATE",
                        "FILE_CONTENTS_REPLY",
                        "WRITE_BYTES_REPLY",
                        "READ_BYTES_REPLY",
                        "CHECKSUM_BYTES_REPLY",
                    ];

                    pub fn enum_name_outbound_payload(e: OutboundPayload) -> &'static str {
                        let index = e as u8;
                        ENUM_NAMES_OUTBOUND_PAYLOAD[index as usize]
                    }

                    pub struct OutboundPayloadUnionTableOffset {}
                    #[allow(non_camel_case_types)]
                    #[repr(u8)]
                    #[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
                    pub enum ErrorPayload {
                        NONE     = 0,
                        READ_OOB = 1,
                    }

                    pub const ENUM_MIN_ERROR_PAYLOAD: u8 = 0;
                    pub const ENUM_MAX_ERROR_PAYLOAD: u8 = 1;

                    impl<'a> flatbuffers::Follow<'a> for ErrorPayload {
                        type Inner = Self;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            flatbuffers::read_scalar_at::<Self>(buf, loc)
                        }
                    }

                    impl flatbuffers::EndianScalar for ErrorPayload {
                        #[inline]
                        fn to_little_endian(self) -> Self {
                            let n = u8::to_le(self as u8);
                            let p = &n as *const u8 as *const ErrorPayload;
                            unsafe { *p }
                        }
                        #[inline]
                        fn from_little_endian(self) -> Self {
                            let n = u8::from_le(self as u8);
                            let p = &n as *const u8 as *const ErrorPayload;
                            unsafe { *p }
                        }
                    }

                    impl flatbuffers::Push for ErrorPayload {
                        type Output = ErrorPayload;
                        #[inline]
                        fn push(&self, dst: &mut [u8], _rest: &[u8]) {
                            flatbuffers::emplace_scalar::<ErrorPayload>(dst, *self);
                        }
                    }

                    #[allow(non_camel_case_types)]
                    pub const ENUM_VALUES_ERROR_PAYLOAD: [ErrorPayload; 2] =
                        [ErrorPayload::NONE, ErrorPayload::READ_OOB];

                    #[allow(non_camel_case_types)]
                    pub const ENUM_NAMES_ERROR_PAYLOAD: [&'static str; 2] = ["NONE", "READ_OOB"];

                    pub fn enum_name_error_payload(e: ErrorPayload) -> &'static str {
                        let index = e as u8;
                        ENUM_NAMES_ERROR_PAYLOAD[index as usize]
                    }

                    pub struct ErrorPayloadUnionTableOffset {}
                    // struct EnsoUUID, aligned to 8
                    #[repr(C, align(8))]
                    #[derive(Clone, Copy, Debug, PartialEq)]
                    pub struct EnsoUUID {
                        leastSigBits_: u64,
                        mostSigBits_:  u64,
                    } // pub struct EnsoUUID
                    impl flatbuffers::SafeSliceAccess for EnsoUUID {}
                    impl<'a> flatbuffers::Follow<'a> for EnsoUUID {
                        type Inner = &'a EnsoUUID;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            <&'a EnsoUUID>::follow(buf, loc)
                        }
                    }
                    impl<'a> flatbuffers::Follow<'a> for &'a EnsoUUID {
                        type Inner = &'a EnsoUUID;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            flatbuffers::follow_cast_ref::<EnsoUUID>(buf, loc)
                        }
                    }
                    impl<'b> flatbuffers::Push for EnsoUUID {
                        type Output = EnsoUUID;
                        #[inline]
                        fn push(&self, dst: &mut [u8], _rest: &[u8]) {
                            let src = unsafe {
                                ::std::slice::from_raw_parts(
                                    self as *const EnsoUUID as *const u8,
                                    Self::size(),
                                )
                            };
                            dst.copy_from_slice(src);
                        }
                    }
                    impl<'b> flatbuffers::Push for &'b EnsoUUID {
                        type Output = EnsoUUID;

                        #[inline]
                        fn push(&self, dst: &mut [u8], _rest: &[u8]) {
                            let src = unsafe {
                                ::std::slice::from_raw_parts(
                                    *self as *const EnsoUUID as *const u8,
                                    Self::size(),
                                )
                            };
                            dst.copy_from_slice(src);
                        }
                    }


                    impl EnsoUUID {
                        pub fn new<'a>(_leastSigBits: u64, _mostSigBits: u64) -> Self {
                            EnsoUUID {
                                leastSigBits_: _leastSigBits.to_little_endian(),
                                mostSigBits_:  _mostSigBits.to_little_endian(),
                            }
                        }
                        pub fn leastSigBits<'a>(&'a self) -> u64 {
                            self.leastSigBits_.from_little_endian()
                        }
                        pub fn mostSigBits<'a>(&'a self) -> u64 {
                            self.mostSigBits_.from_little_endian()
                        }
                    }

                    pub enum InboundMessageOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct InboundMessage<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for InboundMessage<'a> {
                        type Inner = InboundMessage<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> InboundMessage<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            InboundMessage { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args InboundMessageArgs<'args>,
                        ) -> flatbuffers::WIPOffset<InboundMessage<'bldr>> {
                            let mut builder = InboundMessageBuilder::new(_fbb);
                            if let Some(x) = args.payload {
                                builder.add_payload(x);
                            }
                            if let Some(x) = args.correlationId {
                                builder.add_correlationId(x);
                            }
                            if let Some(x) = args.messageId {
                                builder.add_messageId(x);
                            }
                            builder.add_payload_type(args.payload_type);
                            builder.finish()
                        }

                        pub const VT_MESSAGEID: flatbuffers::VOffsetT = 4;
                        pub const VT_CORRELATIONID: flatbuffers::VOffsetT = 6;
                        pub const VT_PAYLOAD_TYPE: flatbuffers::VOffsetT = 8;
                        pub const VT_PAYLOAD: flatbuffers::VOffsetT = 10;

                        #[inline]
                        pub fn messageId(&self) -> &'a EnsoUUID {
                            self._tab.get::<EnsoUUID>(InboundMessage::VT_MESSAGEID, None).unwrap()
                        }
                        #[inline]
                        pub fn correlationId(&self) -> Option<&'a EnsoUUID> {
                            self._tab.get::<EnsoUUID>(InboundMessage::VT_CORRELATIONID, None)
                        }
                        #[inline]
                        pub fn payload_type(&self) -> InboundPayload {
                            self._tab
                                .get::<InboundPayload>(
                                    InboundMessage::VT_PAYLOAD_TYPE,
                                    Some(InboundPayload::NONE),
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn payload(&self) -> flatbuffers::Table<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Table<'a>>>(
                                    InboundMessage::VT_PAYLOAD,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_init_session_cmd(
                            &self,
                        ) -> Option<InitSessionCommand<'a>> {
                            if self.payload_type() == InboundPayload::INIT_SESSION_CMD {
                                let u = self.payload();
                                Some(InitSessionCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_write_file_cmd(&self) -> Option<WriteFileCommand<'a>> {
                            if self.payload_type() == InboundPayload::WRITE_FILE_CMD {
                                let u = self.payload();
                                Some(WriteFileCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_read_file_cmd(&self) -> Option<ReadFileCommand<'a>> {
                            if self.payload_type() == InboundPayload::READ_FILE_CMD {
                                let u = self.payload();
                                Some(ReadFileCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_write_bytes_cmd(&self) -> Option<WriteBytesCommand<'a>> {
                            if self.payload_type() == InboundPayload::WRITE_BYTES_CMD {
                                let u = self.payload();
                                Some(WriteBytesCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_read_bytes_cmd(&self) -> Option<ReadBytesCommand<'a>> {
                            if self.payload_type() == InboundPayload::READ_BYTES_CMD {
                                let u = self.payload();
                                Some(ReadBytesCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_checksum_bytes_cmd(
                            &self,
                        ) -> Option<ChecksumBytesCommand<'a>> {
                            if self.payload_type() == InboundPayload::CHECKSUM_BYTES_CMD {
                                let u = self.payload();
                                Some(ChecksumBytesCommand::init_from_table(u))
                            } else {
                                None
                            }
                        }
                    }

                    pub struct InboundMessageArgs<'a> {
                        pub messageId:     Option<&'a EnsoUUID>,
                        pub correlationId: Option<&'a EnsoUUID>,
                        pub payload_type:  InboundPayload,
                        pub payload: Option<flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>>,
                    }
                    impl<'a> Default for InboundMessageArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            InboundMessageArgs {
                                messageId:     None, // required field
                                correlationId: None,
                                payload_type:  InboundPayload::NONE,
                                payload:       None, // required field
                            }
                        }
                    }
                    pub struct InboundMessageBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> InboundMessageBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_messageId(&mut self, messageId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                InboundMessage::VT_MESSAGEID,
                                messageId,
                            );
                        }
                        #[inline]
                        pub fn add_correlationId(&mut self, correlationId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                InboundMessage::VT_CORRELATIONID,
                                correlationId,
                            );
                        }
                        #[inline]
                        pub fn add_payload_type(&mut self, payload_type: InboundPayload) {
                            self.fbb_.push_slot::<InboundPayload>(
                                InboundMessage::VT_PAYLOAD_TYPE,
                                payload_type,
                                InboundPayload::NONE,
                            );
                        }
                        #[inline]
                        pub fn add_payload(
                            &mut self,
                            payload: flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                InboundMessage::VT_PAYLOAD,
                                payload,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> InboundMessageBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            InboundMessageBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<InboundMessage<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, InboundMessage::VT_MESSAGEID, "message_id");
                            self.fbb_.required(o, InboundMessage::VT_PAYLOAD, "payload");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum OutboundMessageOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct OutboundMessage<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for OutboundMessage<'a> {
                        type Inner = OutboundMessage<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> OutboundMessage<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            OutboundMessage { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args OutboundMessageArgs<'args>,
                        ) -> flatbuffers::WIPOffset<OutboundMessage<'bldr>>
                        {
                            let mut builder = OutboundMessageBuilder::new(_fbb);
                            if let Some(x) = args.payload {
                                builder.add_payload(x);
                            }
                            if let Some(x) = args.correlationId {
                                builder.add_correlationId(x);
                            }
                            if let Some(x) = args.messageId {
                                builder.add_messageId(x);
                            }
                            builder.add_payload_type(args.payload_type);
                            builder.finish()
                        }

                        pub const VT_MESSAGEID: flatbuffers::VOffsetT = 4;
                        pub const VT_CORRELATIONID: flatbuffers::VOffsetT = 6;
                        pub const VT_PAYLOAD_TYPE: flatbuffers::VOffsetT = 8;
                        pub const VT_PAYLOAD: flatbuffers::VOffsetT = 10;

                        #[inline]
                        pub fn messageId(&self) -> &'a EnsoUUID {
                            self._tab.get::<EnsoUUID>(OutboundMessage::VT_MESSAGEID, None).unwrap()
                        }
                        #[inline]
                        pub fn correlationId(&self) -> Option<&'a EnsoUUID> {
                            self._tab.get::<EnsoUUID>(OutboundMessage::VT_CORRELATIONID, None)
                        }
                        #[inline]
                        pub fn payload_type(&self) -> OutboundPayload {
                            self._tab
                                .get::<OutboundPayload>(
                                    OutboundMessage::VT_PAYLOAD_TYPE,
                                    Some(OutboundPayload::NONE),
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn payload(&self) -> flatbuffers::Table<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Table<'a>>>(
                                    OutboundMessage::VT_PAYLOAD,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_error(&self) -> Option<Error<'a>> {
                            if self.payload_type() == OutboundPayload::ERROR {
                                let u = self.payload();
                                Some(Error::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_success(&self) -> Option<Success<'a>> {
                            if self.payload_type() == OutboundPayload::SUCCESS {
                                let u = self.payload();
                                Some(Success::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_visualisation_update(
                            &self,
                        ) -> Option<VisualisationUpdate<'a>> {
                            if self.payload_type() == OutboundPayload::VISUALISATION_UPDATE {
                                let u = self.payload();
                                Some(VisualisationUpdate::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_file_contents_reply(
                            &self,
                        ) -> Option<FileContentsReply<'a>> {
                            if self.payload_type() == OutboundPayload::FILE_CONTENTS_REPLY {
                                let u = self.payload();
                                Some(FileContentsReply::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_write_bytes_reply(&self) -> Option<WriteBytesReply<'a>> {
                            if self.payload_type() == OutboundPayload::WRITE_BYTES_REPLY {
                                let u = self.payload();
                                Some(WriteBytesReply::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_read_bytes_reply(&self) -> Option<ReadBytesReply<'a>> {
                            if self.payload_type() == OutboundPayload::READ_BYTES_REPLY {
                                let u = self.payload();
                                Some(ReadBytesReply::init_from_table(u))
                            } else {
                                None
                            }
                        }

                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn payload_as_checksum_bytes_reply(
                            &self,
                        ) -> Option<ChecksumBytesReply<'a>> {
                            if self.payload_type() == OutboundPayload::CHECKSUM_BYTES_REPLY {
                                let u = self.payload();
                                Some(ChecksumBytesReply::init_from_table(u))
                            } else {
                                None
                            }
                        }
                    }

                    pub struct OutboundMessageArgs<'a> {
                        pub messageId:     Option<&'a EnsoUUID>,
                        pub correlationId: Option<&'a EnsoUUID>,
                        pub payload_type:  OutboundPayload,
                        pub payload: Option<flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>>,
                    }
                    impl<'a> Default for OutboundMessageArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            OutboundMessageArgs {
                                messageId:     None, // required field
                                correlationId: None,
                                payload_type:  OutboundPayload::NONE,
                                payload:       None, // required field
                            }
                        }
                    }
                    pub struct OutboundMessageBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> OutboundMessageBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_messageId(&mut self, messageId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                OutboundMessage::VT_MESSAGEID,
                                messageId,
                            );
                        }
                        #[inline]
                        pub fn add_correlationId(&mut self, correlationId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                OutboundMessage::VT_CORRELATIONID,
                                correlationId,
                            );
                        }
                        #[inline]
                        pub fn add_payload_type(&mut self, payload_type: OutboundPayload) {
                            self.fbb_.push_slot::<OutboundPayload>(
                                OutboundMessage::VT_PAYLOAD_TYPE,
                                payload_type,
                                OutboundPayload::NONE,
                            );
                        }
                        #[inline]
                        pub fn add_payload(
                            &mut self,
                            payload: flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                OutboundMessage::VT_PAYLOAD,
                                payload,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> OutboundMessageBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            OutboundMessageBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<OutboundMessage<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, OutboundMessage::VT_MESSAGEID, "message_id");
                            self.fbb_.required(o, OutboundMessage::VT_PAYLOAD, "payload");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ErrorOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct Error<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for Error<'a> {
                        type Inner = Error<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> Error<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            Error { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ErrorArgs<'args>,
                        ) -> flatbuffers::WIPOffset<Error<'bldr>> {
                            let mut builder = ErrorBuilder::new(_fbb);
                            if let Some(x) = args.data {
                                builder.add_data(x);
                            }
                            if let Some(x) = args.message {
                                builder.add_message(x);
                            }
                            builder.add_code(args.code);
                            builder.add_data_type(args.data_type);
                            builder.finish()
                        }

                        pub const VT_CODE: flatbuffers::VOffsetT = 4;
                        pub const VT_MESSAGE: flatbuffers::VOffsetT = 6;
                        pub const VT_DATA_TYPE: flatbuffers::VOffsetT = 8;
                        pub const VT_DATA: flatbuffers::VOffsetT = 10;

                        #[inline]
                        pub fn code(&self) -> i32 {
                            self._tab.get::<i32>(Error::VT_CODE, Some(0)).unwrap()
                        }
                        #[inline]
                        pub fn message(&self) -> &'a str {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<&str>>(Error::VT_MESSAGE, None)
                                .unwrap()
                        }
                        #[inline]
                        pub fn data_type(&self) -> ErrorPayload {
                            self._tab
                                .get::<ErrorPayload>(Error::VT_DATA_TYPE, Some(ErrorPayload::NONE))
                                .unwrap()
                        }
                        #[inline]
                        pub fn data(&self) -> Option<flatbuffers::Table<'a>> {
                            self._tab.get::<flatbuffers::ForwardsUOffset<flatbuffers::Table<'a>>>(
                                Error::VT_DATA,
                                None,
                            )
                        }
                        #[inline]
                        #[allow(non_snake_case)]
                        pub fn data_as_read_oob(&self) -> Option<ReadOutOfBoundsError<'a>> {
                            if self.data_type() == ErrorPayload::READ_OOB {
                                self.data().map(|u| ReadOutOfBoundsError::init_from_table(u))
                            } else {
                                None
                            }
                        }
                    }

                    pub struct ErrorArgs<'a> {
                        pub code:      i32,
                        pub message:   Option<flatbuffers::WIPOffset<&'a str>>,
                        pub data_type: ErrorPayload,
                        pub data:      Option<flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>>,
                    }
                    impl<'a> Default for ErrorArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ErrorArgs {
                                code:      0,
                                message:   None, // required field
                                data_type: ErrorPayload::NONE,
                                data:      None,
                            }
                        }
                    }
                    pub struct ErrorBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ErrorBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_code(&mut self, code: i32) {
                            self.fbb_.push_slot::<i32>(Error::VT_CODE, code, 0);
                        }
                        #[inline]
                        pub fn add_message(&mut self, message: flatbuffers::WIPOffset<&'b str>) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                Error::VT_MESSAGE,
                                message,
                            );
                        }
                        #[inline]
                        pub fn add_data_type(&mut self, data_type: ErrorPayload) {
                            self.fbb_.push_slot::<ErrorPayload>(
                                Error::VT_DATA_TYPE,
                                data_type,
                                ErrorPayload::NONE,
                            );
                        }
                        #[inline]
                        pub fn add_data(
                            &mut self,
                            data: flatbuffers::WIPOffset<flatbuffers::UnionWIPOffset>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                Error::VT_DATA,
                                data,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ErrorBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ErrorBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<Error<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, Error::VT_MESSAGE, "message");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ReadOutOfBoundsErrorOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ReadOutOfBoundsError<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ReadOutOfBoundsError<'a> {
                        type Inner = ReadOutOfBoundsError<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ReadOutOfBoundsError<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ReadOutOfBoundsError { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ReadOutOfBoundsErrorArgs,
                        ) -> flatbuffers::WIPOffset<ReadOutOfBoundsError<'bldr>>
                        {
                            let mut builder = ReadOutOfBoundsErrorBuilder::new(_fbb);
                            builder.add_fileLength(args.fileLength);
                            builder.finish()
                        }

                        pub const VT_FILELENGTH: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn fileLength(&self) -> u64 {
                            self._tab
                                .get::<u64>(ReadOutOfBoundsError::VT_FILELENGTH, Some(0))
                                .unwrap()
                        }
                    }

                    pub struct ReadOutOfBoundsErrorArgs {
                        pub fileLength: u64,
                    }
                    impl<'a> Default for ReadOutOfBoundsErrorArgs {
                        #[inline]
                        fn default() -> Self {
                            ReadOutOfBoundsErrorArgs { fileLength: 0 }
                        }
                    }
                    pub struct ReadOutOfBoundsErrorBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ReadOutOfBoundsErrorBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_fileLength(&mut self, fileLength: u64) {
                            self.fbb_.push_slot::<u64>(
                                ReadOutOfBoundsError::VT_FILELENGTH,
                                fileLength,
                                0,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ReadOutOfBoundsErrorBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ReadOutOfBoundsErrorBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ReadOutOfBoundsError<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum SuccessOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct Success<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for Success<'a> {
                        type Inner = Success<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> Success<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            Success { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            _args: &'args SuccessArgs,
                        ) -> flatbuffers::WIPOffset<Success<'bldr>> {
                            let mut builder = SuccessBuilder::new(_fbb);
                            builder.finish()
                        }
                    }

                    pub struct SuccessArgs {}
                    impl<'a> Default for SuccessArgs {
                        #[inline]
                        fn default() -> Self {
                            SuccessArgs {}
                        }
                    }
                    pub struct SuccessBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> SuccessBuilder<'a, 'b> {
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> SuccessBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            SuccessBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<Success<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum InitSessionCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct InitSessionCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for InitSessionCommand<'a> {
                        type Inner = InitSessionCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> InitSessionCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            InitSessionCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args InitSessionCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<InitSessionCommand<'bldr>>
                        {
                            let mut builder = InitSessionCommandBuilder::new(_fbb);
                            if let Some(x) = args.identifier {
                                builder.add_identifier(x);
                            }
                            builder.finish()
                        }

                        pub const VT_IDENTIFIER: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn identifier(&self) -> &'a EnsoUUID {
                            self._tab
                                .get::<EnsoUUID>(InitSessionCommand::VT_IDENTIFIER, None)
                                .unwrap()
                        }
                    }

                    pub struct InitSessionCommandArgs<'a> {
                        pub identifier: Option<&'a EnsoUUID>,
                    }
                    impl<'a> Default for InitSessionCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            InitSessionCommandArgs {
            identifier: None, // required field
        }
                        }
                    }
                    pub struct InitSessionCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> InitSessionCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_identifier(&mut self, identifier: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                InitSessionCommand::VT_IDENTIFIER,
                                identifier,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> InitSessionCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            InitSessionCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<InitSessionCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, InitSessionCommand::VT_IDENTIFIER, "identifier");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum VisualisationContextOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct VisualisationContext<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for VisualisationContext<'a> {
                        type Inner = VisualisationContext<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> VisualisationContext<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            VisualisationContext { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args VisualisationContextArgs<'args>,
                        ) -> flatbuffers::WIPOffset<VisualisationContext<'bldr>>
                        {
                            let mut builder = VisualisationContextBuilder::new(_fbb);
                            if let Some(x) = args.expressionId {
                                builder.add_expressionId(x);
                            }
                            if let Some(x) = args.contextId {
                                builder.add_contextId(x);
                            }
                            if let Some(x) = args.visualisationId {
                                builder.add_visualisationId(x);
                            }
                            builder.finish()
                        }

                        pub const VT_VISUALISATIONID: flatbuffers::VOffsetT = 4;
                        pub const VT_CONTEXTID: flatbuffers::VOffsetT = 6;
                        pub const VT_EXPRESSIONID: flatbuffers::VOffsetT = 8;

                        #[inline]
                        pub fn visualisationId(&self) -> &'a EnsoUUID {
                            self._tab
                                .get::<EnsoUUID>(VisualisationContext::VT_VISUALISATIONID, None)
                                .unwrap()
                        }
                        #[inline]
                        pub fn contextId(&self) -> &'a EnsoUUID {
                            self._tab
                                .get::<EnsoUUID>(VisualisationContext::VT_CONTEXTID, None)
                                .unwrap()
                        }
                        #[inline]
                        pub fn expressionId(&self) -> &'a EnsoUUID {
                            self._tab
                                .get::<EnsoUUID>(VisualisationContext::VT_EXPRESSIONID, None)
                                .unwrap()
                        }
                    }

                    pub struct VisualisationContextArgs<'a> {
                        pub visualisationId: Option<&'a EnsoUUID>,
                        pub contextId:       Option<&'a EnsoUUID>,
                        pub expressionId:    Option<&'a EnsoUUID>,
                    }
                    impl<'a> Default for VisualisationContextArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            VisualisationContextArgs {
                                visualisationId: None, // required field
                                contextId:       None, // required field
                                expressionId:    None, // required field
                            }
                        }
                    }
                    pub struct VisualisationContextBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> VisualisationContextBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_visualisationId(&mut self, visualisationId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                VisualisationContext::VT_VISUALISATIONID,
                                visualisationId,
                            );
                        }
                        #[inline]
                        pub fn add_contextId(&mut self, contextId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                VisualisationContext::VT_CONTEXTID,
                                contextId,
                            );
                        }
                        #[inline]
                        pub fn add_expressionId(&mut self, expressionId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(
                                VisualisationContext::VT_EXPRESSIONID,
                                expressionId,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> VisualisationContextBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            VisualisationContextBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<VisualisationContext<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(
                                o,
                                VisualisationContext::VT_VISUALISATIONID,
                                "visualisation_id",
                            );
                            self.fbb_.required(o, VisualisationContext::VT_CONTEXTID, "context_id");
                            self.fbb_.required(
                                o,
                                VisualisationContext::VT_EXPRESSIONID,
                                "expression_id",
                            );
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum VisualisationUpdateOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct VisualisationUpdate<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for VisualisationUpdate<'a> {
                        type Inner = VisualisationUpdate<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> VisualisationUpdate<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            VisualisationUpdate { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args VisualisationUpdateArgs<'args>,
                        ) -> flatbuffers::WIPOffset<VisualisationUpdate<'bldr>>
                        {
                            let mut builder = VisualisationUpdateBuilder::new(_fbb);
                            if let Some(x) = args.data {
                                builder.add_data(x);
                            }
                            if let Some(x) = args.visualisationContext {
                                builder.add_visualisationContext(x);
                            }
                            builder.finish()
                        }

                        pub const VT_VISUALISATIONCONTEXT: flatbuffers::VOffsetT = 4;
                        pub const VT_DATA: flatbuffers::VOffsetT = 6;

                        #[inline]
                        pub fn visualisationContext(&self) -> VisualisationContext<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<VisualisationContext<'a>>>(
                                    VisualisationUpdate::VT_VISUALISATIONCONTEXT,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn data(&self) -> &'a [u8] {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    VisualisationUpdate::VT_DATA,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                                .unwrap()
                        }
                    }

                    pub struct VisualisationUpdateArgs<'a> {
                        pub visualisationContext:
                            Option<flatbuffers::WIPOffset<VisualisationContext<'a>>>,
                        pub data: Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for VisualisationUpdateArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            VisualisationUpdateArgs {
                                visualisationContext: None, // required field
                                data:                 None, // required field
                            }
                        }
                    }
                    pub struct VisualisationUpdateBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> VisualisationUpdateBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_visualisationContext(
                            &mut self,
                            visualisationContext: flatbuffers::WIPOffset<VisualisationContext<'b>>,
                        ) {
                            self.fbb_
                                .push_slot_always::<flatbuffers::WIPOffset<VisualisationContext>>(
                                    VisualisationUpdate::VT_VISUALISATIONCONTEXT,
                                    visualisationContext,
                                );
                        }
                        #[inline]
                        pub fn add_data(
                            &mut self,
                            data: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                VisualisationUpdate::VT_DATA,
                                data,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> VisualisationUpdateBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            VisualisationUpdateBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<VisualisationUpdate<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(
                                o,
                                VisualisationUpdate::VT_VISUALISATIONCONTEXT,
                                "visualisation_context",
                            );
                            self.fbb_.required(o, VisualisationUpdate::VT_DATA, "data");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum PathOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct Path<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for Path<'a> {
                        type Inner = Path<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> Path<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            Path { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args PathArgs<'args>,
                        ) -> flatbuffers::WIPOffset<Path<'bldr>> {
                            let mut builder = PathBuilder::new(_fbb);
                            if let Some(x) = args.segments {
                                builder.add_segments(x);
                            }
                            if let Some(x) = args.rootId {
                                builder.add_rootId(x);
                            }
                            builder.finish()
                        }

                        pub const VT_ROOTID: flatbuffers::VOffsetT = 4;
                        pub const VT_SEGMENTS: flatbuffers::VOffsetT = 6;

                        #[inline]
                        pub fn rootId(&self) -> Option<&'a EnsoUUID> {
                            self._tab.get::<EnsoUUID>(Path::VT_ROOTID, None)
                        }
                        #[inline]
                        pub fn segments(
                            &self,
                        ) -> Option<flatbuffers::Vector<'a, flatbuffers::ForwardsUOffset<&'a str>>>
                        {
                            self._tab.get::<flatbuffers::ForwardsUOffset<
                                flatbuffers::Vector<flatbuffers::ForwardsUOffset<&'a str>>,
                            >>(Path::VT_SEGMENTS, None)
                        }
                    }

                    pub struct PathArgs<'a> {
                        pub rootId:   Option<&'a EnsoUUID>,
                        pub segments: Option<
                            flatbuffers::WIPOffset<
                                flatbuffers::Vector<'a, flatbuffers::ForwardsUOffset<&'a str>>,
                            >,
                        >,
                    }
                    impl<'a> Default for PathArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            PathArgs { rootId: None, segments: None }
                        }
                    }
                    pub struct PathBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> PathBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_rootId(&mut self, rootId: &'b EnsoUUID) {
                            self.fbb_.push_slot_always::<&EnsoUUID>(Path::VT_ROOTID, rootId);
                        }
                        #[inline]
                        pub fn add_segments(
                            &mut self,
                            segments: flatbuffers::WIPOffset<
                                flatbuffers::Vector<'b, flatbuffers::ForwardsUOffset<&'b str>>,
                            >,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                Path::VT_SEGMENTS,
                                segments,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> PathBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            PathBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<Path<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum WriteFileCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct WriteFileCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for WriteFileCommand<'a> {
                        type Inner = WriteFileCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> WriteFileCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            WriteFileCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args WriteFileCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<WriteFileCommand<'bldr>>
                        {
                            let mut builder = WriteFileCommandBuilder::new(_fbb);
                            if let Some(x) = args.contents {
                                builder.add_contents(x);
                            }
                            if let Some(x) = args.path {
                                builder.add_path(x);
                            }
                            builder.finish()
                        }

                        pub const VT_PATH: flatbuffers::VOffsetT = 4;
                        pub const VT_CONTENTS: flatbuffers::VOffsetT = 6;

                        #[inline]
                        pub fn path(&self) -> Option<Path<'a>> {
                            self._tab.get::<flatbuffers::ForwardsUOffset<Path<'a>>>(
                                WriteFileCommand::VT_PATH,
                                None,
                            )
                        }
                        #[inline]
                        pub fn contents(&self) -> Option<&'a [u8]> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    WriteFileCommand::VT_CONTENTS,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                        }
                    }

                    pub struct WriteFileCommandArgs<'a> {
                        pub path:     Option<flatbuffers::WIPOffset<Path<'a>>>,
                        pub contents: Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for WriteFileCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            WriteFileCommandArgs { path: None, contents: None }
                        }
                    }
                    pub struct WriteFileCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> WriteFileCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_path(&mut self, path: flatbuffers::WIPOffset<Path<'b>>) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<Path>>(
                                WriteFileCommand::VT_PATH,
                                path,
                            );
                        }
                        #[inline]
                        pub fn add_contents(
                            &mut self,
                            contents: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                WriteFileCommand::VT_CONTENTS,
                                contents,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> WriteFileCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            WriteFileCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<WriteFileCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ReadFileCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ReadFileCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ReadFileCommand<'a> {
                        type Inner = ReadFileCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ReadFileCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ReadFileCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ReadFileCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<ReadFileCommand<'bldr>>
                        {
                            let mut builder = ReadFileCommandBuilder::new(_fbb);
                            if let Some(x) = args.path {
                                builder.add_path(x);
                            }
                            builder.finish()
                        }

                        pub const VT_PATH: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn path(&self) -> Option<Path<'a>> {
                            self._tab.get::<flatbuffers::ForwardsUOffset<Path<'a>>>(
                                ReadFileCommand::VT_PATH,
                                None,
                            )
                        }
                    }

                    pub struct ReadFileCommandArgs<'a> {
                        pub path: Option<flatbuffers::WIPOffset<Path<'a>>>,
                    }
                    impl<'a> Default for ReadFileCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ReadFileCommandArgs { path: None }
                        }
                    }
                    pub struct ReadFileCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ReadFileCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_path(&mut self, path: flatbuffers::WIPOffset<Path<'b>>) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<Path>>(
                                ReadFileCommand::VT_PATH,
                                path,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ReadFileCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ReadFileCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ReadFileCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum FileContentsReplyOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct FileContentsReply<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for FileContentsReply<'a> {
                        type Inner = FileContentsReply<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> FileContentsReply<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            FileContentsReply { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args FileContentsReplyArgs<'args>,
                        ) -> flatbuffers::WIPOffset<FileContentsReply<'bldr>>
                        {
                            let mut builder = FileContentsReplyBuilder::new(_fbb);
                            if let Some(x) = args.contents {
                                builder.add_contents(x);
                            }
                            builder.finish()
                        }

                        pub const VT_CONTENTS: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn contents(&self) -> Option<&'a [u8]> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    FileContentsReply::VT_CONTENTS,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                        }
                    }

                    pub struct FileContentsReplyArgs<'a> {
                        pub contents: Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for FileContentsReplyArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            FileContentsReplyArgs { contents: None }
                        }
                    }
                    pub struct FileContentsReplyBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> FileContentsReplyBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_contents(
                            &mut self,
                            contents: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                FileContentsReply::VT_CONTENTS,
                                contents,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> FileContentsReplyBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            FileContentsReplyBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<FileContentsReply<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum WriteBytesCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct WriteBytesCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for WriteBytesCommand<'a> {
                        type Inner = WriteBytesCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> WriteBytesCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            WriteBytesCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args WriteBytesCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<WriteBytesCommand<'bldr>>
                        {
                            let mut builder = WriteBytesCommandBuilder::new(_fbb);
                            builder.add_byteOffset(args.byteOffset);
                            if let Some(x) = args.bytes {
                                builder.add_bytes(x);
                            }
                            if let Some(x) = args.path {
                                builder.add_path(x);
                            }
                            builder.add_overwriteExisting(args.overwriteExisting);
                            builder.finish()
                        }

                        pub const VT_PATH: flatbuffers::VOffsetT = 4;
                        pub const VT_BYTEOFFSET: flatbuffers::VOffsetT = 6;
                        pub const VT_OVERWRITEEXISTING: flatbuffers::VOffsetT = 8;
                        pub const VT_BYTES: flatbuffers::VOffsetT = 10;

                        #[inline]
                        pub fn path(&self) -> Path<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<Path<'a>>>(
                                    WriteBytesCommand::VT_PATH,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn byteOffset(&self) -> u64 {
                            self._tab.get::<u64>(WriteBytesCommand::VT_BYTEOFFSET, Some(0)).unwrap()
                        }
                        #[inline]
                        pub fn overwriteExisting(&self) -> bool {
                            self._tab
                                .get::<bool>(WriteBytesCommand::VT_OVERWRITEEXISTING, Some(false))
                                .unwrap()
                        }
                        #[inline]
                        pub fn bytes(&self) -> &'a [u8] {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    WriteBytesCommand::VT_BYTES,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                                .unwrap()
                        }
                    }

                    pub struct WriteBytesCommandArgs<'a> {
                        pub path:              Option<flatbuffers::WIPOffset<Path<'a>>>,
                        pub byteOffset:        u64,
                        pub overwriteExisting: bool,
                        pub bytes: Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for WriteBytesCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            WriteBytesCommandArgs {
                                path:              None, // required field
                                byteOffset:        0,
                                overwriteExisting: false,
                                bytes:             None, // required field
                            }
                        }
                    }
                    pub struct WriteBytesCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> WriteBytesCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_path(&mut self, path: flatbuffers::WIPOffset<Path<'b>>) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<Path>>(
                                WriteBytesCommand::VT_PATH,
                                path,
                            );
                        }
                        #[inline]
                        pub fn add_byteOffset(&mut self, byteOffset: u64) {
                            self.fbb_.push_slot::<u64>(
                                WriteBytesCommand::VT_BYTEOFFSET,
                                byteOffset,
                                0,
                            );
                        }
                        #[inline]
                        pub fn add_overwriteExisting(&mut self, overwriteExisting: bool) {
                            self.fbb_.push_slot::<bool>(
                                WriteBytesCommand::VT_OVERWRITEEXISTING,
                                overwriteExisting,
                                false,
                            );
                        }
                        #[inline]
                        pub fn add_bytes(
                            &mut self,
                            bytes: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                WriteBytesCommand::VT_BYTES,
                                bytes,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> WriteBytesCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            WriteBytesCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<WriteBytesCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, WriteBytesCommand::VT_PATH, "path");
                            self.fbb_.required(o, WriteBytesCommand::VT_BYTES, "bytes");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum WriteBytesReplyOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct WriteBytesReply<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for WriteBytesReply<'a> {
                        type Inner = WriteBytesReply<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> WriteBytesReply<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            WriteBytesReply { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args WriteBytesReplyArgs<'args>,
                        ) -> flatbuffers::WIPOffset<WriteBytesReply<'bldr>>
                        {
                            let mut builder = WriteBytesReplyBuilder::new(_fbb);
                            if let Some(x) = args.checksum {
                                builder.add_checksum(x);
                            }
                            builder.finish()
                        }

                        pub const VT_CHECKSUM: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn checksum(&self) -> EnsoDigest<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<EnsoDigest<'a>>>(
                                    WriteBytesReply::VT_CHECKSUM,
                                    None,
                                )
                                .unwrap()
                        }
                    }

                    pub struct WriteBytesReplyArgs<'a> {
                        pub checksum: Option<flatbuffers::WIPOffset<EnsoDigest<'a>>>,
                    }
                    impl<'a> Default for WriteBytesReplyArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            WriteBytesReplyArgs {
            checksum: None, // required field
        }
                        }
                    }
                    pub struct WriteBytesReplyBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> WriteBytesReplyBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_checksum(
                            &mut self,
                            checksum: flatbuffers::WIPOffset<EnsoDigest<'b>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<EnsoDigest>>(
                                WriteBytesReply::VT_CHECKSUM,
                                checksum,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> WriteBytesReplyBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            WriteBytesReplyBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<WriteBytesReply<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, WriteBytesReply::VT_CHECKSUM, "checksum");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ReadBytesCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ReadBytesCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ReadBytesCommand<'a> {
                        type Inner = ReadBytesCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ReadBytesCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ReadBytesCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ReadBytesCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<ReadBytesCommand<'bldr>>
                        {
                            let mut builder = ReadBytesCommandBuilder::new(_fbb);
                            if let Some(x) = args.segment {
                                builder.add_segment(x);
                            }
                            builder.finish()
                        }

                        pub const VT_SEGMENT: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn segment(&self) -> FileSegment<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<FileSegment<'a>>>(
                                    ReadBytesCommand::VT_SEGMENT,
                                    None,
                                )
                                .unwrap()
                        }
                    }

                    pub struct ReadBytesCommandArgs<'a> {
                        pub segment: Option<flatbuffers::WIPOffset<FileSegment<'a>>>,
                    }
                    impl<'a> Default for ReadBytesCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ReadBytesCommandArgs {
            segment: None, // required field
        }
                        }
                    }
                    pub struct ReadBytesCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ReadBytesCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_segment(
                            &mut self,
                            segment: flatbuffers::WIPOffset<FileSegment<'b>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<FileSegment>>(
                                ReadBytesCommand::VT_SEGMENT,
                                segment,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ReadBytesCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ReadBytesCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ReadBytesCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, ReadBytesCommand::VT_SEGMENT, "segment");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ReadBytesReplyOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ReadBytesReply<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ReadBytesReply<'a> {
                        type Inner = ReadBytesReply<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ReadBytesReply<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ReadBytesReply { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ReadBytesReplyArgs<'args>,
                        ) -> flatbuffers::WIPOffset<ReadBytesReply<'bldr>> {
                            let mut builder = ReadBytesReplyBuilder::new(_fbb);
                            if let Some(x) = args.bytes {
                                builder.add_bytes(x);
                            }
                            if let Some(x) = args.checksum {
                                builder.add_checksum(x);
                            }
                            builder.finish()
                        }

                        pub const VT_CHECKSUM: flatbuffers::VOffsetT = 4;
                        pub const VT_BYTES: flatbuffers::VOffsetT = 6;

                        #[inline]
                        pub fn checksum(&self) -> EnsoDigest<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<EnsoDigest<'a>>>(
                                    ReadBytesReply::VT_CHECKSUM,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn bytes(&self) -> &'a [u8] {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    ReadBytesReply::VT_BYTES,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                                .unwrap()
                        }
                    }

                    pub struct ReadBytesReplyArgs<'a> {
                        pub checksum: Option<flatbuffers::WIPOffset<EnsoDigest<'a>>>,
                        pub bytes:    Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for ReadBytesReplyArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ReadBytesReplyArgs {
                                checksum: None, // required field
                                bytes:    None, // required field
                            }
                        }
                    }
                    pub struct ReadBytesReplyBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ReadBytesReplyBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_checksum(
                            &mut self,
                            checksum: flatbuffers::WIPOffset<EnsoDigest<'b>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<EnsoDigest>>(
                                ReadBytesReply::VT_CHECKSUM,
                                checksum,
                            );
                        }
                        #[inline]
                        pub fn add_bytes(
                            &mut self,
                            bytes: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                ReadBytesReply::VT_BYTES,
                                bytes,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ReadBytesReplyBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ReadBytesReplyBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ReadBytesReply<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, ReadBytesReply::VT_CHECKSUM, "checksum");
                            self.fbb_.required(o, ReadBytesReply::VT_BYTES, "bytes");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ChecksumBytesCommandOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ChecksumBytesCommand<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ChecksumBytesCommand<'a> {
                        type Inner = ChecksumBytesCommand<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ChecksumBytesCommand<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ChecksumBytesCommand { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ChecksumBytesCommandArgs<'args>,
                        ) -> flatbuffers::WIPOffset<ChecksumBytesCommand<'bldr>>
                        {
                            let mut builder = ChecksumBytesCommandBuilder::new(_fbb);
                            if let Some(x) = args.segment {
                                builder.add_segment(x);
                            }
                            builder.finish()
                        }

                        pub const VT_SEGMENT: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn segment(&self) -> FileSegment<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<FileSegment<'a>>>(
                                    ChecksumBytesCommand::VT_SEGMENT,
                                    None,
                                )
                                .unwrap()
                        }
                    }

                    pub struct ChecksumBytesCommandArgs<'a> {
                        pub segment: Option<flatbuffers::WIPOffset<FileSegment<'a>>>,
                    }
                    impl<'a> Default for ChecksumBytesCommandArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ChecksumBytesCommandArgs {
            segment: None, // required field
        }
                        }
                    }
                    pub struct ChecksumBytesCommandBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ChecksumBytesCommandBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_segment(
                            &mut self,
                            segment: flatbuffers::WIPOffset<FileSegment<'b>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<FileSegment>>(
                                ChecksumBytesCommand::VT_SEGMENT,
                                segment,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ChecksumBytesCommandBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ChecksumBytesCommandBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ChecksumBytesCommand<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, ChecksumBytesCommand::VT_SEGMENT, "segment");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum ChecksumBytesReplyOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct ChecksumBytesReply<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for ChecksumBytesReply<'a> {
                        type Inner = ChecksumBytesReply<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> ChecksumBytesReply<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            ChecksumBytesReply { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args ChecksumBytesReplyArgs<'args>,
                        ) -> flatbuffers::WIPOffset<ChecksumBytesReply<'bldr>>
                        {
                            let mut builder = ChecksumBytesReplyBuilder::new(_fbb);
                            if let Some(x) = args.checksum {
                                builder.add_checksum(x);
                            }
                            builder.finish()
                        }

                        pub const VT_CHECKSUM: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn checksum(&self) -> EnsoDigest<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<EnsoDigest<'a>>>(
                                    ChecksumBytesReply::VT_CHECKSUM,
                                    None,
                                )
                                .unwrap()
                        }
                    }

                    pub struct ChecksumBytesReplyArgs<'a> {
                        pub checksum: Option<flatbuffers::WIPOffset<EnsoDigest<'a>>>,
                    }
                    impl<'a> Default for ChecksumBytesReplyArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            ChecksumBytesReplyArgs {
            checksum: None, // required field
        }
                        }
                    }
                    pub struct ChecksumBytesReplyBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> ChecksumBytesReplyBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_checksum(
                            &mut self,
                            checksum: flatbuffers::WIPOffset<EnsoDigest<'b>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<EnsoDigest>>(
                                ChecksumBytesReply::VT_CHECKSUM,
                                checksum,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> ChecksumBytesReplyBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            ChecksumBytesReplyBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<ChecksumBytesReply<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, ChecksumBytesReply::VT_CHECKSUM, "checksum");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum EnsoDigestOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct EnsoDigest<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for EnsoDigest<'a> {
                        type Inner = EnsoDigest<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> EnsoDigest<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            EnsoDigest { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args EnsoDigestArgs<'args>,
                        ) -> flatbuffers::WIPOffset<EnsoDigest<'bldr>> {
                            let mut builder = EnsoDigestBuilder::new(_fbb);
                            if let Some(x) = args.bytes {
                                builder.add_bytes(x);
                            }
                            builder.finish()
                        }

                        pub const VT_BYTES: flatbuffers::VOffsetT = 4;

                        #[inline]
                        pub fn bytes(&self) -> &'a [u8] {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<flatbuffers::Vector<'a, u8>>>(
                                    EnsoDigest::VT_BYTES,
                                    None,
                                )
                                .map(|v| v.safe_slice())
                                .unwrap()
                        }
                    }

                    pub struct EnsoDigestArgs<'a> {
                        pub bytes: Option<flatbuffers::WIPOffset<flatbuffers::Vector<'a, u8>>>,
                    }
                    impl<'a> Default for EnsoDigestArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            EnsoDigestArgs {
            bytes: None, // required field
        }
                        }
                    }
                    pub struct EnsoDigestBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> EnsoDigestBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_bytes(
                            &mut self,
                            bytes: flatbuffers::WIPOffset<flatbuffers::Vector<'b, u8>>,
                        ) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<_>>(
                                EnsoDigest::VT_BYTES,
                                bytes,
                            );
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> EnsoDigestBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            EnsoDigestBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<EnsoDigest<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, EnsoDigest::VT_BYTES, "bytes");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    pub enum FileSegmentOffset {}
                    #[derive(Copy, Clone, Debug, PartialEq)]

                    pub struct FileSegment<'a> {
                        pub _tab: flatbuffers::Table<'a>,
                    }

                    impl<'a> flatbuffers::Follow<'a> for FileSegment<'a> {
                        type Inner = FileSegment<'a>;
                        #[inline]
                        fn follow(buf: &'a [u8], loc: usize) -> Self::Inner {
                            Self { _tab: flatbuffers::Table { buf, loc } }
                        }
                    }

                    impl<'a> FileSegment<'a> {
                        #[inline]
                        pub fn init_from_table(table: flatbuffers::Table<'a>) -> Self {
                            FileSegment { _tab: table }
                        }
                        #[allow(unused_mut)]
                        pub fn create<'bldr: 'args, 'args: 'mut_bldr, 'mut_bldr>(
                            _fbb: &'mut_bldr mut flatbuffers::FlatBufferBuilder<'bldr>,
                            args: &'args FileSegmentArgs<'args>,
                        ) -> flatbuffers::WIPOffset<FileSegment<'bldr>> {
                            let mut builder = FileSegmentBuilder::new(_fbb);
                            builder.add_length(args.length);
                            builder.add_byteOffset(args.byteOffset);
                            if let Some(x) = args.path {
                                builder.add_path(x);
                            }
                            builder.finish()
                        }

                        pub const VT_PATH: flatbuffers::VOffsetT = 4;
                        pub const VT_BYTEOFFSET: flatbuffers::VOffsetT = 6;
                        pub const VT_LENGTH: flatbuffers::VOffsetT = 8;

                        #[inline]
                        pub fn path(&self) -> Path<'a> {
                            self._tab
                                .get::<flatbuffers::ForwardsUOffset<Path<'a>>>(
                                    FileSegment::VT_PATH,
                                    None,
                                )
                                .unwrap()
                        }
                        #[inline]
                        pub fn byteOffset(&self) -> u64 {
                            self._tab.get::<u64>(FileSegment::VT_BYTEOFFSET, Some(0)).unwrap()
                        }
                        #[inline]
                        pub fn length(&self) -> u64 {
                            self._tab.get::<u64>(FileSegment::VT_LENGTH, Some(0)).unwrap()
                        }
                    }

                    pub struct FileSegmentArgs<'a> {
                        pub path:       Option<flatbuffers::WIPOffset<Path<'a>>>,
                        pub byteOffset: u64,
                        pub length:     u64,
                    }
                    impl<'a> Default for FileSegmentArgs<'a> {
                        #[inline]
                        fn default() -> Self {
                            FileSegmentArgs {
                                path:       None, // required field
                                byteOffset: 0,
                                length:     0,
                            }
                        }
                    }
                    pub struct FileSegmentBuilder<'a: 'b, 'b> {
                        fbb_:   &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        start_: flatbuffers::WIPOffset<flatbuffers::TableUnfinishedWIPOffset>,
                    }
                    impl<'a: 'b, 'b> FileSegmentBuilder<'a, 'b> {
                        #[inline]
                        pub fn add_path(&mut self, path: flatbuffers::WIPOffset<Path<'b>>) {
                            self.fbb_.push_slot_always::<flatbuffers::WIPOffset<Path>>(
                                FileSegment::VT_PATH,
                                path,
                            );
                        }
                        #[inline]
                        pub fn add_byteOffset(&mut self, byteOffset: u64) {
                            self.fbb_.push_slot::<u64>(FileSegment::VT_BYTEOFFSET, byteOffset, 0);
                        }
                        #[inline]
                        pub fn add_length(&mut self, length: u64) {
                            self.fbb_.push_slot::<u64>(FileSegment::VT_LENGTH, length, 0);
                        }
                        #[inline]
                        pub fn new(
                            _fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        ) -> FileSegmentBuilder<'a, 'b> {
                            let start = _fbb.start_table();
                            FileSegmentBuilder { fbb_: _fbb, start_: start }
                        }
                        #[inline]
                        pub fn finish(self) -> flatbuffers::WIPOffset<FileSegment<'a>> {
                            let o = self.fbb_.end_table(self.start_);
                            self.fbb_.required(o, FileSegment::VT_PATH, "path");
                            flatbuffers::WIPOffset::new(o.value())
                        }
                    }

                    #[inline]
                    pub fn get_root_as_init_session_command<'a>(
                        buf: &'a [u8],
                    ) -> InitSessionCommand<'a> {
                        flatbuffers::get_root::<InitSessionCommand<'a>>(buf)
                    }

                    #[inline]
                    pub fn get_size_prefixed_root_as_init_session_command<'a>(
                        buf: &'a [u8],
                    ) -> InitSessionCommand<'a> {
                        flatbuffers::get_size_prefixed_root::<InitSessionCommand<'a>>(buf)
                    }

                    #[inline]
                    pub fn finish_init_session_command_buffer<'a, 'b>(
                        fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        root: flatbuffers::WIPOffset<InitSessionCommand<'a>>,
                    ) {
                        fbb.finish(root, None);
                    }

                    #[inline]
                    pub fn finish_size_prefixed_init_session_command_buffer<'a, 'b>(
                        fbb: &'b mut flatbuffers::FlatBufferBuilder<'a>,
                        root: flatbuffers::WIPOffset<InitSessionCommand<'a>>,
                    ) {
                        fbb.finish_size_prefixed(root, None);
                    }
                } // pub mod binary
            } // pub mod protocol
        } // pub mod languageserver
    } // pub mod enso
} // pub mod org
