execute_process(
    COMMAND git -C ${CMAKE_SOURCE_DIR} describe --always --dirty 
    OUTPUT_VARIABLE REVISION
)
string(STRIP ${BUILD_SWUP} NAME)
string(STRIP ${REVISION} REVISION)
set(OUTPUT_FOLDER ${CMAKE_SOURCE_DIR}/../../../output/${NAME}/)
set(NAME "${NAME}_${REVISION}")

# Check if BUILD_TYPE is set to either DEBUG or RELEASE
if(NOT (BUILD_TYPE STREQUAL "DEBUG" OR BUILD_TYPE STREQUAL "RELEASE"))
    message(WARNING "Invalid BUILD_TYPE. BUILD_TYPE set to RELEASE.")
    set(BUILD_TYPE "RELEASE")
endif()

message(STATUS "Name set to ${NAME}")
message(STATUS "Output folder is ${OUTPUT_FOLDER}")
message(STATUS "Build type: ${BUILD_TYPE}")

# Generation of checksum field: configuration phase
execute_process(
    COMMAND echo "#define PROGRAM_CHECKSUM (0xffffffff)"
    OUTPUT_FILE "${CMAKE_SOURCE_DIR}/checksum.h"
)

execute_process(
    COMMAND sh ${PERSEUS_SDK}/scripts/genVersion.sh ${CMAKE_SOURCE_DIR}
    COMMAND mkdir -p ${OUTPUT_FOLDER}
)

# Post-build hook for calculating checksum section
set_property(
    GLOBAL 
    APPEND 
    PROPERTY extra_post_build_commands
            COMMAND python3 ${PERSEUS_SDK}/scripts/calculate_checksum.py ${CMAKE_BINARY_DIR}/zephyr/zephyr.bin ${CMAKE_SOURCE_DIR}/checksum.h ${CMAKE_BINARY_DIR}/zephyr/.checksum.bin ${CMAKE_BINARY_DIR}/zephyr/.config
)

# Post-build hook for concatenating the bootloader and built binaries
if(${BOARD} STREQUAL "gs25")
    set(LEGACY_BOOTLOADER_SUFFIX ".gs25")
elseif(${BOARD} STREQUAL "precision_9")
    set(LEGACY_BOOTLOADER_SUFFIX ".precision9")
elseif(${BOARD} STREQUAL "CV01")
    set(LEGACY_BOOTLOADER_SUFFIX ".hs65")
elseif(${BOARD} STREQUAL "PCBA_30923_C0")
    set(LEGACY_BOOTLOADER_SUFFIX ".hs65")
elseif(${BOARD} STREQUAL "PCBA_34272_A0")
    set(LEGACY_BOOTLOADER_SUFFIX ".hs65")
else()
    set(LEGACY_BOOTLOADER_SUFFIX "")
endif()
set(LEGACY_BOOTLOADER_FILENAME "STM32F205Bootloader16MHz.bin${LEGACY_BOOTLOADER_SUFFIX}")

if(${CONFIG_HACK_FOR_MEDUSA_P9_BOOTLOADER})
    set(UPLOAD_ADDRESS 0x8010000) # Bootloader is 64KB
    set(APP_ADDRESS 0x8010100)    # App starts after bootloader + header
else()
    set(UPLOAD_ADDRESS 0x8010000) # Bootloader is 128KB
    set(APP_ADDRESS 0x8010200)    # App starts after bootloader + header
endif()

find_file(LEGACY_BOOTLOADER_BIN 
    NAMES ${LEGACY_BOOTLOADER_FILENAME}
    PATHS 
        "${CMAKE_SOURCE_DIR}" 
        "${PERSEUS_SDK}" 
        "${PERSEUS_SDK}/.."
)
if(EXISTS ${LEGACY_BOOTLOADER_BIN})
    message("Using bootloader binary at ${LEGACY_BOOTLOADER_BIN}")
    set_property(
        GLOBAL 
        APPEND 
        PROPERTY extra_post_build_commands
                COMMAND python3 ${PERSEUS_SDK}/scripts/combine_binaries.py ${CMAKE_BINARY_DIR}/zephyr/zephyr.bin ${LEGACY_BOOTLOADER_BIN} ${OUTPUT_FOLDER}${NAME}.fullbinary.bin ${CMAKE_BINARY_DIR}/zephyr/.config
    )
else()
    message(WARNING
        "Bootloader binary file does not exist!\n"
        "A bootloader binary file with the name:\n"
        "   ${LEGACY_BOOTLOADER_FILENAME}\n"
        "is expected to generate the full-binary output. The absence of such "
        "a file may not block the build process, but the full-binary won't be "
        "generated.\n"
        "The bootloader file can be set up in the Perseus dev environment in "
        "the following ways:\n"
        "* If using a docker, the file should have been incoporated in the docker.\n"
        "* If using native toolchains, the file can be manually downloaded from "
        "   artifactory or built from Medusa.\n"
        "Refer to Confluence page <placeholder> for more detailed instructions.\n"
    )
    set_property(
        GLOBAL 
        APPEND 
        PROPERTY extra_post_build_commands
                COMMAND echo "Warning: full-binary was not generated because of the missing bootloader binary."
    )
endif()

find_package(Zephyr-sdk)
# swup generate post build calls
set_property(
	GLOBAL
	APPEND
	PROPERTY extra_post_build_commands
		COMMAND ${ZEPHYR_SDK_INSTALL_DIR}/arm-zephyr-eabi/bin/arm-zephyr-eabi-objcopy
		ARGS --update-section header_checksum=${CMAKE_BINARY_DIR}/zephyr/.checksum.bin -Osrec ${CMAKE_BINARY_DIR}/zephyr/zephyr.elf ${OUTPUT_FOLDER}${NAME}.srec
		COMMAND ${ZEPHYR_SDK_INSTALL_DIR}/arm-zephyr-eabi/bin/arm-zephyr-eabi-objcopy
		ARGS --update-section header_checksum=${CMAKE_BINARY_DIR}/zephyr/.checksum.bin --gap-fill 0xFF -Obinary ${CMAKE_BINARY_DIR}/zephyr/zephyr.elf ${OUTPUT_FOLDER}${NAME}.checksum.bin
		COMMAND ${ZEPHYR_SDK_INSTALL_DIR}/arm-zephyr-eabi/bin/arm-zephyr-eabi-objcopy
		ARGS --update-section header_checksum=${CMAKE_BINARY_DIR}/zephyr/.checksum.bin --gap-fill 0xFF -Oelf32-littlearm ${CMAKE_BINARY_DIR}/zephyr/zephyr.elf ${OUTPUT_FOLDER}debug_target.elf
		COMMAND python3 ${PERSEUS_SDK}/scripts/swup/SWUPGen.py ${OUTPUT_FOLDER}${NAME}.srec 1.0 ${UPLOAD_ADDRESS} 0x8010004 0x8010008 ${APP_ADDRESS} --config-file ${CMAKE_BINARY_DIR}/zephyr/.config --version-header ${CMAKE_SOURCE_DIR}/src/Version.h --output-folder ${OUTPUT_FOLDER} --build-type ${BUILD_TYPE}
)